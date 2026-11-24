import { t } from '../text/ko'
import type { NoteEvent, TimeSignatureChange } from './types'

/** 1 step = 16분음표. 4분음표 = 4 step (MusicXML divisions = 4) */
export const STEPS_PER_QUARTER = 4

/** 16분음표 격자에 맞춘 음표 (step 단위) */
export interface QNote {
  start: number
  end: number
  midi: number
  velocity: number
  /** true면 덜 주된 음 (회색으로 그린다) */
  minor?: boolean
}

export interface QuantizeResult {
  notes: QNote[]
  /** 시작 위치가 16분음표 격자에서 크게 벗어난 음표 수 (3연음 등 격자에 안 맞는 리듬의 신호) */
  offGrid: number
}

/** 16분음표 한 칸의 틱 수 */
export const gridTicks = (ppq: number) => ppq / STEPS_PER_QUARTER

/**
 * 음표의 시작·끝을 16분음표 격자에 반올림한다. MIDI는 이미 박 단위 위치(틱)를 가지므로
 * PPQ(4분음표당 틱 수)만 있으면 템포와 무관하게 계산된다.
 */
export function quantizeNotes(notes: NoteEvent[], ppq: number): QuantizeResult {
  const g = gridTicks(ppq)
  let offGrid = 0
  const byKey = new Map<string, QNote>()
  for (const n of notes) {
    const s = n.ticks / g
    const e = (n.ticks + n.durationTicks) / g
    const start = Math.round(s)
    const end = Math.max(start + 1, Math.round(e)) // 아주 짧은 음도 최소 1칸
    // 격자 이탈은 시작 위치만 본다. 음을 끝까지 누르지 않고 살짝 떼는 것(스타카토·레가토)은 정상 연주이므로 제외.
    if (Math.abs(s - start) > 0.3) offGrid++
    // 같은 시작·같은 높이의 중복 음은 하나로 (더 긴 쪽 유지)
    const key = `${start}:${n.midi}`
    const prev = byKey.get(key)
    // 둘 중 하나라도 주된 음이면 합친 음도 주된 음이다
    const minor = prev ? !!(prev.minor && n.minor) : !!n.minor
    if (!prev || prev.end < end) byKey.set(key, { start, end, midi: n.midi, velocity: n.velocity, minor })
    else prev.minor = minor
  }
  return { notes: [...byKey.values()].sort((a, b) => a.start - b.start || b.midi - a.midi), offGrid }
}

/**
 * 한 줄 선율로 만든다: 칸에 맞춘 뒤에도 겹치는 음이 없게 한다. (음원 분석 결과용, 기획서 12장)
 * 초 단위로는 겹치지 않던 음도 16분음표 칸으로 반올림하면 같은 칸에 놓이거나 1칸 겹칠 수 있다.
 * - 같은 칸에서 시작한 음은 더 긴 음(같으면 더 높은 음) 하나만 남긴다.
 * - 앞 음이 다음 음 시작 뒤까지 이어지면 다음 음이 시작하는 칸에서 끊는다.
 */
export function enforceMonophonic(notes: QNote[]): QNote[] {
  const sorted = [...notes].sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || b.midi - a.midi)
  const out: QNote[] = []
  for (const n of sorted) {
    const last = out[out.length - 1]
    if (last && n.start <= last.start) continue
    if (last && n.start < last.end) last.end = n.start
    out.push({ ...n })
  }
  return out
}

export interface MeasureSpec {
  startStep: number
  length: number // step 수
  numerator: number
  denominator: number
}

/** 한 마디의 step 수. 분모가 2의 거듭제곱(1~16)이어야 16분음표 격자에 정확히 놓인다. */
export function measureLength(numerator: number, denominator: number): number | null {
  if (![1, 2, 4, 8, 16].includes(denominator) || numerator < 1) return null
  return (numerator * 16) / denominator
}

/** 한 박의 step 수 (6/8·9/8·12/8 같은 겹박자는 점4분음표가 한 박) */
export function beatSteps(numerator: number, denominator: number): number {
  if (denominator === 8 && numerator % 3 === 0 && numerator >= 6) return 6
  return 16 / denominator
}

export interface MeasureGrid {
  measures: MeasureSpec[]
  warnings: string[]
}

/** 박자표 변화를 반영해 곡 전체의 마디 경계를 만든다. 박자 변화는 다음 마디 시작부터 적용된다. */
export function buildMeasureGrid(timeSigs: TimeSignatureChange[], ppq: number, totalSteps: number): MeasureGrid {
  const g = gridTicks(ppq)
  const warnings: string[] = []
  const sigs = (timeSigs.length ? [...timeSigs] : [{ ticks: 0, numerator: 4, denominator: 4 }])
    .sort((a, b) => a.ticks - b.ticks)
    .map((t) => ({ step: Math.round(t.ticks / g), numerator: t.numerator, denominator: t.denominator }))

  const measures: MeasureSpec[] = []
  let step = 0
  let unsupported = false
  while (step < Math.max(1, totalSteps)) {
    let active = sigs[0]
    for (const s of sigs) if (s.step <= step) active = s
    let len = measureLength(active.numerator, active.denominator)
    let { numerator, denominator } = active
    if (len === null) {
      unsupported = true
      numerator = 4
      denominator = 4
      len = 16
    }
    measures.push({ startStep: step, length: len, numerator, denominator })
    step += len
  }
  if (unsupported) warnings.push(t.warnings.unsupportedTimeSignature)
  return { measures, warnings }
}

/** 한 단(손)에 동시에 적을 수 있는 음의 최대 개수 (음원 분석의 들리는 대로 악보) */
export const MAX_CHORD_NOTES = 4

/**
 * 같은 때 울리는 음을 화음으로 묶어 한 성부로 정리한다 (음원 분석의 "들리는 대로" 악보).
 * - 같은 시작의 음은 한 화음이다. 4음을 넘으면 가장 낮은 음·가장 높은 음(바깥 음)과 세기가 센 음을 남긴다.
 * - 화음은 다음 화음이 시작하기 전까지만 울린다 (겹쳐 이어지는 음을 잘라 읽기 쉽게 한다). 더 일찍 끝나면 그만큼 쉼표가 된다.
 * - 같은 높이가 같은 시작에 둘 있으면 하나로 합친다.
 * 결과는 서로 겹치지 않는 화음의 나열이다 (한 성부).
 */
export function simplifyToChords(notes: QNote[], maxNotes = MAX_CHORD_NOTES): QNote[] {
  if (!notes.length) return []
  const byStart = new Map<number, QNote[]>()
  for (const n of notes) {
    const g = byStart.get(n.start)
    if (g) g.push(n)
    else byStart.set(n.start, [n])
  }
  const starts = [...byStart.keys()].sort((a, b) => a - b)
  const out: QNote[] = []
  starts.forEach((start, i) => {
    // 같은 높이는 하나로 (더 긴 것, 더 센 것을 남긴다)
    const uniq = new Map<number, QNote>()
    for (const n of byStart.get(start)!) {
      const cur = uniq.get(n.midi)
      if (!cur || n.end > cur.end || (n.end === cur.end && n.velocity > cur.velocity)) uniq.set(n.midi, n)
    }
    let group = [...uniq.values()].sort((a, b) => a.midi - b.midi)
    if (group.length > maxNotes) {
      const keep = new Set<QNote>([group[0], group[group.length - 1]])
      for (const n of [...group].sort((a, b) => b.velocity - a.velocity)) {
        if (keep.size >= maxNotes) break
        keep.add(n)
      }
      group = group.filter((n) => keep.has(n))
    }
    const nextStart = i + 1 < starts.length ? starts[i + 1] : Infinity
    const end = Math.max(start + 1, Math.min(nextStart, Math.max(...group.map((n) => n.end))))
    for (const n of group) out.push({ start, end, midi: n.midi, velocity: n.velocity, minor: n.minor })
  })
  return out
}
