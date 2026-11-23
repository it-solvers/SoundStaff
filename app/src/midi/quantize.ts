import type { NoteEvent, TimeSignatureChange } from './types'

/** 1 step = 16분음표. 4분음표 = 4 step (MusicXML divisions = 4) */
export const STEPS_PER_QUARTER = 4

/** 16분음표 격자에 맞춘 음표 (step 단위) */
export interface QNote {
  start: number
  end: number
  midi: number
  velocity: number
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
    if (!prev || prev.end < end) byKey.set(key, { start, end, midi: n.midi, velocity: n.velocity })
  }
  return { notes: [...byKey.values()].sort((a, b) => a.start - b.start || b.midi - a.midi), offGrid }
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
  if (unsupported) warnings.push('지원하지 않는 박자표(분모가 1·2·4·8·16이 아님)가 있어 해당 구간을 4/4로 처리했습니다.')
  return { measures, warnings }
}
