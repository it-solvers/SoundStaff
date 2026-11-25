import { resolveEditTuning, type EditTuning } from '../audio/editTuning'
import { t } from '../text'
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
 * MIDI 악보 "읽기 쉽게": 한 보표를 한 성부(화음의 나열)로 만든다. 음은 하나도 빼지 않고 길이만 맞춘다.
 * 같은 칸에서 시작한 음은 그중 가장 긴 길이로 묶고, 다음 음이 시작하면 거기서 끊는다. 1칸짜리 틈은 메운다.
 */
export function toSingleVoice(notes: QNote[]): QNote[] {
  const ends = new Map<number, number>()
  for (const n of notes) ends.set(n.start, Math.max(ends.get(n.start) ?? 0, n.end))
  const starts = [...ends.keys()].sort((a, b) => a - b)
  starts.forEach((start, i) => {
    const next = starts[i + 1]
    const end = ends.get(start)!
    if (next !== undefined && (end > next || next - end <= 1)) ends.set(start, next)
  })
  return notes.map((n) => ({ ...n, end: ends.get(n.start)! }))
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

/** 편집용 정리에서 같은 높이의 음을 이어 붙이는 틈 (16분음표 칸 수). 2칸 = 8분음표 */
export const EDIT_JOIN_STEPS = 2

/** 편집용 정리에서 음의 시작·끝을 다시 맞추는 칸 (16분음표 칸 수). 2칸 = 8분음표 */
export const EDIT_GRID_STEPS = 2

/**
 * 정한 시각(starts)마다, 그때 울리고 있는 음 전체를 화음 하나로 잡아 한 성부로 만든다.
 * 오래 끄는 음도 다음 시각에 사라지지 않고 화음에 남는다(simplifyToChords는 다음 시작에서 끊어 버려 오래 끄는 음을 잃는다).
 * 화음은 다음 시각까지 울리고, 같은 음 구성이 바로 이어지면 하나의 긴 화음으로 합친다. 한 화음은 maxNotes음까지(가장 낮은 음·높은 음·센 음).
 */
function chordifyAt(
  notes: QNote[],
  starts: number[],
  maxNotes: number,
  mergeSame = true,
  smooth?: { steps: number; similarity: number },
): QNote[] {
  type Seg = { start: number; end: number; midis: number[]; vel: Map<number, number> }
  let segs: Seg[] = []
  starts.forEach((t, i) => {
    const active = notes.filter((n) => n.start <= t && n.end > t)
    if (!active.length) return
    const next = i + 1 < starts.length ? starts[i + 1] : Infinity
    const end = Math.min(next, Math.max(...active.map((n) => n.end)))
    const vel = new Map<number, number>()
    for (const n of active) vel.set(n.midi, Math.max(vel.get(n.midi) ?? 0, n.velocity))
    let midis = [...vel.keys()].sort((a, b) => a - b)
    if (midis.length > maxNotes) {
      // 가장 낮은 음·높은 음은 남기고, 나머지는 앞 화음에서 이어져 오는 음을 먼저(계속 울리는 음이 한 번 빠졌다 다시 들어오지 않게), 그다음 센 음을 남긴다
      const prev = segs[segs.length - 1]
      const carried = (m: number) => (prev && prev.end >= t && prev.midis.includes(m) ? 1 : 0)
      const keep = new Set([midis[0], midis[midis.length - 1]])
      for (const m of [...midis].sort((a, b) => carried(b) - carried(a) || vel.get(b)! - vel.get(a)!)) {
        if (keep.size >= maxNotes) break
        keep.add(m)
      }
      midis = midis.filter((m) => keep.has(m))
    }
    segs.push({ start: t, end, midis, vel })
  })
  if (mergeSame) {
    // 앞뒤 화음에는 있는데 가운데 화음에만 빠진 음(자리가 모자라 빠진 경우)은 채워 넣어 한 음으로 이어지게 한다
    for (let k = 1; k + 1 < segs.length; k++) {
      const a = segs[k - 1]
      const c = segs[k]
      const d = segs[k + 1]
      if (a.end < c.start || c.end < d.start) continue
      for (const m of a.midis) {
        if (c.midis.length >= maxNotes) break
        if (d.midis.includes(m) && !c.midis.includes(m)) {
          c.midis = [...c.midis, m].sort((x, y) => x - y)
          c.vel.set(m, a.vel.get(m) ?? 0.5)
        }
      }
    }
    // 짧게 스쳐 지나가는 화음 변화(앞 화음과 비슷하고 가장 낮은 음이 같다)는 앞 화음에 합쳐 고칠 곳을 줄인다
    if (smooth && smooth.steps > 0) {
      const kept: Seg[] = []
      for (const g of segs) {
        const prev = kept[kept.length - 1]
        if (prev && prev.end >= g.start && g.end - g.start <= smooth.steps && prev.midis[0] === g.midis[0]) {
          const common = g.midis.filter((m) => prev.midis.includes(m)).length
          const union = new Set([...g.midis, ...prev.midis]).size
          if (common / union >= smooth.similarity) {
            prev.end = Math.max(prev.end, g.end)
            continue
          }
        }
        kept.push(g)
      }
      segs = kept
    }
    const merged: Seg[] = []
    for (const g of segs) {
      const prev = merged[merged.length - 1]
      if (
        prev &&
        prev.end >= g.start &&
        prev.midis.length === g.midis.length &&
        prev.midis.every((m, k) => m === g.midis[k])
      ) {
        prev.end = Math.max(prev.end, g.end)
      } else merged.push(g)
    }
    segs = merged
  }
  return segs.flatMap((g) => g.midis.map((m) => ({ start: g.start, end: g.end, midi: m, velocity: g.vel.get(m)! })))
}

/** 어떤 음이 시작하는 순간마다 울리는 음 전체를 화음으로 잡는다 */
export function chordifyByOnset(notes: QNote[], maxNotes = MAX_CHORD_NOTES): QNote[] {
  return chordifyAt(
    notes,
    [...new Set(notes.map((n) => n.start))].sort((a, b) => a - b),
    maxNotes,
  )
}

/**
 * 박(beatStep칸)마다 울리는 음 전체를 화음으로 잡는다. 박 사이에서 시작한 짧은 음(아르페지오·장식음)은 새 화음을 만들지 않아서,
 * 합창 같은 긴 화음이 피아노 아르페지오 때문에 8분음표마다 잘게 쪼개지지 않는다. 박 사이에서 시작해도 한 박 이상 이어지는 음은 새 화음의 경계가 된다.
 */
export function chordifyByBeat(
  notes: QNote[],
  beatStep = STEPS_PER_QUARTER,
  maxNotes = MAX_CHORD_NOTES,
  mergeSame = true,
  smooth?: { steps: number; similarity: number },
): QNote[] {
  if (!notes.length) return []
  const last = Math.max(...notes.map((n) => n.end))
  const starts = new Set<number>()
  for (let t = 0; t < last; t += beatStep) starts.add(t)
  for (const n of notes) if (n.end - n.start >= beatStep) starts.add(n.start)
  return chordifyAt(
    notes,
    [...starts].sort((a, b) => a - b),
    maxNotes,
    mergeSame,
    smooth,
  )
}

/** 박 가까이(1칸 이내)면 박에 붙이고, 아니면 8분음표 칸에 맞춘다 */
export function snapToBeatOrEighth(v: number, beatStep = STEPS_PER_QUARTER): number {
  const beat = Math.round(v / beatStep) * beatStep
  return Math.abs(v - beat) <= 1 ? beat : Math.round(v / 2) * 2
}

/**
 * Finale에서 고치기 쉽게 정리한다 (음원 분석의 편집용 악보). 결과는 겹치지 않는 화음의 나열(한 성부)이다.
 * ① 같은 높이로 이어지거나 EDIT_JOIN_STEPS칸 이내로 끊긴 음은 하나로 합친다 (join이 false면 합치지 않는다).
 * ② 16분음표 하나짜리 짧은 음은 뺀다 (편집할 때 가장 성가신 잔 조각. 전부 사라지게 되면 남겨 둔다).
 * ③ 남은 음의 시작·끝을 박(4분음표) 가까이면 박에, 아니면 8분음표 칸에 다시 맞춘다. AI가 찾은 음은 16분음표보다 짧게 흔들리는 일이 많아서, 16분음표 칸 그대로 두면 16분음표·16분쉼표 조각이 수두룩해진다.
 * ④ 박마다 울리는 음을 화음으로 묶어 한 성부로 만들고, 같은 화음이 이어지면 하나로 합친다(chordifyByBeat).
 */
export function tidyForEditing(notes: QNote[], join = true, tuning?: Partial<EditTuning>): QNote[] {
  const tn = resolveEditTuning(tuning)
  const byPitch = new Map<number, QNote[]>()
  for (const n of notes) {
    const list = byPitch.get(n.midi)
    if (list) list.push({ ...n })
    else byPitch.set(n.midi, [{ ...n }])
  }
  let joined: QNote[] = []
  for (const list of byPitch.values()) {
    list.sort((a, b) => a.start - b.start)
    let cur = list[0]
    for (const n of list.slice(1)) {
      if (join && n.start - cur.end <= tn.joinSteps) {
        cur.end = Math.max(cur.end, n.end)
        cur.velocity = Math.max(cur.velocity, n.velocity)
      } else {
        joined.push(cur)
        cur = n
      }
    }
    joined.push(cur)
  }
  const longer = joined.filter((n) => n.end - n.start > 1)
  if (longer.length) joined = longer
  const snap = (v: number) => snapToBeatOrEighth(v)
  joined = joined.map((n) => {
    const start = snap(n.start)
    return { ...n, start, end: Math.max(start + EDIT_GRID_STEPS, snap(n.end - tn.endBias)) }
  })
  return chordifyByBeat(joined, STEPS_PER_QUARTER, tn.maxNotes, join, {
    steps: tn.smoothSteps,
    similarity: tn.smoothSimilarity,
  })
}
