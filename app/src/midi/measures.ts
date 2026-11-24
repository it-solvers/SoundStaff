import { t } from '../text/ko'
import { beatSteps, type MeasureSpec, type QNote } from './quantize'

/** 표기 가능한 한 덩어리 (음표·화음 또는 쉼표). midis가 비면 쉼표 */
export interface Piece {
  duration: number
  midis: number[]
  tieStart: boolean
  tieStop: boolean
}

export interface VoiceMeasure {
  voice: number
  pieces: Piece[]
  /** 마디 전체가 쉼표 하나 (표기: 온마디 쉼표) */
  wholeRest: boolean
}

/** 같은 시작·같은 끝의 음 묶음 = 화음 하나 */
interface ChordEvent {
  start: number
  end: number
  midis: number[]
}

export const MAX_VOICES = 4

/** MusicXML이 표기할 수 있는 길이(step) */
const DURATIONS = [32, 24, 16, 12, 8, 6, 4, 3, 2, 1]

/** 길이 d의 음표를 마디 안 위치 p에서 시작해도 박 구조가 자연스러운가 */
function allowedAt(d: number, p: number, beat: number): boolean {
  switch (d) {
    case 1:
      return true
    case 2:
      return p % 2 === 0
    case 3:
      return p % (beat >= 4 ? 4 : 2) === 0
    case 4:
      return p % (beat % 4 === 0 ? 4 : 2) === 0
    case 6:
      return p % (beat === 6 ? 6 : 4) === 0
    case 8:
      return beat !== 6 && p % 8 === 0
    case 12:
      return p % (beat === 6 ? 12 : 16) === 0
    default:
      return p % d === 0 // 16, 24, 32
  }
}

/**
 * 길이를 박 정렬을 지키며 표기 가능한 길이들로 나눈다.
 * 음이 이어져야 하면(나눈 뒤에도 남는 길이가 있으면) 박 위치에서 끝나는 조각을 우선한다.
 * 예) 4/4의 둘째 박에서 시작하는 2분음표는 점4분+8분이 아니라 4분+4분으로 나눈다.
 */
export function decompose(pos: number, len: number, beat: number): number[] {
  const out: number[] = []
  let p = pos
  let left = len
  while (left > 0) {
    const fits = DURATIONS.filter((c) => c <= left && allowedAt(c, p, beat))
    const d = fits.find((c) => c === left || (p + c) % beat === 0) ?? fits[0] ?? 1
    out.push(d)
    p += d
    left -= d
  }
  return out
}

export interface TrackLayout {
  /** measures[마디][성부] */
  measures: VoiceMeasure[][]
  warnings: string[]
}

/** 같은 시작·끝의 음을 화음으로 묶는다 */
function toChordEvents(notes: QNote[]): ChordEvent[] {
  const map = new Map<string, ChordEvent>()
  for (const n of notes) {
    const key = `${n.start}:${n.end}`
    const e = map.get(key)
    if (e) e.midis.push(n.midi)
    else map.set(key, { start: n.start, end: n.end, midis: [n.midi] })
  }
  const events = [...map.values()]
  for (const e of events) e.midis.sort((a, b) => a - b)
  // 같은 시작이면 높은 음이 먼저 → 1성부(위쪽 선율)에 배정된다
  return events.sort((a, b) => a.start - b.start || b.midis[b.midis.length - 1] - a.midis[a.midis.length - 1])
}

/** 겹치는 음을 성부로 나눈다. 이어 연주(레가토)로 1칸 이하만 겹친 음은 앞 음을 잘라 성부를 늘리지 않는다. */
function trimLegatoOverlap(events: ChordEvent[]): void {
  // 1칸 이하 겹침은 앞 음을 다음 음 시작에서 끊는다
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i]
      const b = events[j]
      if (b.start >= a.end) break
      if (b.start > a.start && a.end - b.start <= 1) a.end = b.start
    }
  }
}

function assignVoices(events: ChordEvent[], warnings: string[], legatoTrim: boolean): ChordEvent[][] {
  if (legatoTrim) trimLegatoOverlap(events)

  const voices: ChordEvent[][] = []
  let merged = 0
  let trimmed = 0
  for (const ev of events) {
    let placed = false
    for (const v of voices) {
      if (v[v.length - 1].end <= ev.start) {
        v.push(ev)
        placed = true
        break
      }
    }
    if (placed) continue
    if (voices.length < MAX_VOICES) {
      voices.push([ev])
      continue
    }
    // 성부 상한 초과: 같은 시작의 화음이 있으면 합치고, 없으면 앞 음을 잘라낸다
    const same = voices.map((v) => v.find((e) => e.start === ev.start)).find(Boolean)
    if (same) {
      same.midis = [...new Set([...same.midis, ...ev.midis])].sort((a, b) => a - b)
      merged++
    } else {
      const v = voices.reduce((best, cur) => (cur[cur.length - 1].end < best[best.length - 1].end ? cur : best))
      const prev = v[v.length - 1]
      // prev.start === ev.start 이면 위에서 같은 시작의 화음(same)을 찾았을 것이므로 여기서는 항상 prev.start < ev.start
      prev.end = ev.start
      v.push(ev)
      trimmed++
    }
  }
  if (merged) warnings.push(t.warnings.voicesMerged(MAX_VOICES, merged))
  if (trimmed) warnings.push(t.warnings.voicesTrimmed(MAX_VOICES, trimmed))
  return voices
}

/** 성부 하나의 음·쉼표 시간선을 마디별 표기 조각(붙임줄 포함)으로 만든다 */
function layoutVoice(events: ChordEvent[], grid: MeasureSpec[]): Piece[][] {
  type Seg = { start: number; end: number; midis: number[] }
  const segs: Seg[] = []
  const total = grid[grid.length - 1].startStep + grid[grid.length - 1].length
  let cursor = 0
  for (const e of events) {
    // 마디 격자 밖으로 나간 음은 격자 끝에서 자른다 (격자는 보통 마지막 음까지 만들지만, 어긋나도 멈추지 않게 한다)
    if (e.start >= total) continue
    const end = Math.min(e.end, total)
    if (e.start > cursor) segs.push({ start: cursor, end: e.start, midis: [] })
    segs.push({ start: e.start, end, midis: e.midis })
    cursor = end
  }
  if (cursor < total) segs.push({ start: cursor, end: total, midis: [] })

  const perMeasure: Piece[][] = grid.map(() => [])
  let mi = 0
  for (const seg of segs) {
    // 이 구간이 걸치는 마디들로 자르기
    const parts: { m: number; start: number; end: number }[] = []
    let pos = seg.start
    while (pos < seg.end) {
      while (mi > 0 && grid[mi].startStep > pos) mi--
      while (mi < grid.length - 1 && grid[mi].startStep + grid[mi].length <= pos) mi++
      const mEnd = grid[mi].startStep + grid[mi].length
      const end = Math.min(seg.end, mEnd)
      parts.push({ m: mi, start: pos, end })
      pos = end
    }
    const isNote = seg.midis.length > 0
    const pieces: { m: number; len: number; posInMeasure: number }[] = []
    for (const part of parts) {
      const m = grid[part.m]
      let p = part.start - m.startStep
      for (const d of decompose(p, part.end - part.start, beatSteps(m.numerator, m.denominator))) {
        pieces.push({ m: part.m, len: d, posInMeasure: p })
        p += d
      }
    }
    pieces.forEach((pc, i) => {
      perMeasure[pc.m].push({
        duration: pc.len,
        midis: seg.midis,
        tieStart: isNote && i < pieces.length - 1,
        tieStop: isNote && i > 0,
      })
    })
  }
  return perMeasure
}

/**
 * 한 트랙(음높이 악기)의 음표를 마디·성부별 표기 조각으로 변환한다.
 * legatoTrim: 1칸 이하로 겹친 음을 앞 음에서 끊을지 (기본 켬). 이미 그 정리를 마친 층(splitIntoLayers)은 끈다.
 * 정리는 한 번만 해야 한다. 거듭 적용하면 시작이 2칸 간격으로 이어진 음의 길이가 칸마다 줄어든다.
 */
export function layoutTrack(notes: QNote[], grid: MeasureSpec[], opts: { legatoTrim?: boolean } = {}): TrackLayout {
  const warnings: string[] = []
  const voices = notes.length ? assignVoices(toChordEvents(notes), warnings, opts.legatoTrim ?? true) : []
  const voiceMeasures = voices.map((v) => layoutVoice(v, grid))

  const measures: VoiceMeasure[][] = grid.map((m, mi) => {
    const out: VoiceMeasure[] = []
    if (!voiceMeasures.length) {
      out.push({
        voice: 1,
        pieces: [{ duration: m.length, midis: [], tieStart: false, tieStop: false }],
        wholeRest: true,
      })
      return out
    }
    voiceMeasures.forEach((vm, vi) => {
      const pieces = vm[mi]
      const allRest = pieces.every((p) => p.midis.length === 0)
      // 1성부는 쉼표뿐인 마디도 표기한다. 2성부 이상은 소리가 있는 마디에서만 쓴다.
      if (vi === 0 || !allRest) out.push({ voice: vi + 1, pieces, wholeRest: allRest })
    })
    return out
  })
  return { measures, warnings }
}

/**
 * 음을 하나도 빼지 않으려고, 한 단(성부 4개 이하)에 다 못 담는 음을 여러 "층"으로 나눈다.
 * 겹치는 음을 성부 수 제한 없이 나눠 본 뒤 maxVoices개씩 묶어 층 하나로 만든다. 각 층은 layoutTrack에 그대로 넘겨도
 * 성부가 maxVoices를 넘지 않으므로 음을 합치거나 길이를 줄이는 일이 생기지 않는다.
 * 음이 적으면 층은 하나다. 층은 위쪽 소리가 많이 든 순서(첫 성부들이 앞)다.
 */
export function splitIntoLayers(notes: QNote[], maxVoices = MAX_VOICES): QNote[][] {
  if (!notes.length) return []
  const events = toChordEvents(notes)
  trimLegatoOverlap(events)
  const voices: ChordEvent[][] = []
  for (const ev of events) {
    const v = voices.find((x) => x[x.length - 1].end <= ev.start)
    if (v) v.push(ev)
    else voices.push([ev])
  }
  const layers: QNote[][] = []
  for (let i = 0; i < voices.length; i += maxVoices) {
    const layer: QNote[] = []
    for (const v of voices.slice(i, i + maxVoices)) {
      for (const e of v) for (const midi of e.midis) layer.push({ start: e.start, end: e.end, midi, velocity: 0.7 })
    }
    layers.push(layer)
  }
  return layers
}
