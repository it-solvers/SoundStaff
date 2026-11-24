import { Midi } from '@tonejs/midi'
import type { MidiFileInfo, NoteEvent, TrackInfo } from '../src/midi/types'

export const PPQ = 480
/** 16분음표 한 칸의 틱 수 */
export const G = PPQ / 4

/** [시작 step, 길이 step, 음높이, 세기] 목록으로 트랙을 만든다 (step = 16분음표) */
export function track(
  index: number,
  name: string,
  notes: [number, number, number, number?][],
  opts: { channel?: number; kind?: 'pitched' | 'drum' | 'empty'; program?: number } = {},
): TrackInfo {
  const events: NoteEvent[] = notes.map(([s, d, p, v]) => ({
    ticks: s * G,
    durationTicks: d * G - 6, // 끝까지 누르지 않고 살짝 뗀 연주
    midi: p,
    velocity: v ?? 0.7,
  }))
  const pitches = notes.map((n) => n[2])
  return {
    index,
    name,
    instrumentName: 'acoustic grand piano',
    instrumentNumber: opts.program ?? 0,
    channel: opts.channel ?? 1,
    noteCount: notes.length,
    kind: opts.kind ?? 'pitched',
    lowestMidi: pitches.length ? Math.min(...pitches) : undefined,
    highestMidi: pitches.length ? Math.max(...pitches) : undefined,
    notes: events,
  }
}

export function info(
  tracks: TrackInfo[],
  opts: Partial<Pick<MidiFileInfo, 'tempos' | 'timeSignatures' | 'keySignatures' | 'fileName'>> = {},
): MidiFileInfo {
  return {
    id: 'test',
    fileName: opts.fileName ?? 'test.mid',
    size: 100,
    ppq: PPQ,
    durationSec: 10,
    tempos: opts.tempos ?? [{ ticks: 0, bpm: 100 }],
    timeSignatures: opts.timeSignatures ?? [{ ticks: 0, numerator: 4, denominator: 4 }],
    keySignatures: opts.keySignatures ?? [],
    tracks,
  }
}

/** 결과가 항상 같은 의사 난수 (시험이 매번 같은 입력으로 돌도록) */
export function rng(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** @tonejs/midi로 MIDI 파일 바이트를 만든다. 쓰기 기능의 조표 오류를 피하려고 조표는 바이트를 직접 고친다. */
export function midiBytes(build: (m: Midi) => void, key?: { sf: number; minor: boolean }): Uint8Array {
  const m = new Midi()
  m.header.update()
  build(m)
  if (key) m.header.keySignatures.push({ ticks: 0, key: 'C', scale: 'major' })
  const buf = Buffer.from(m.toArray())
  if (key) {
    const i = buf.indexOf(Buffer.from([0xff, 0x59, 0x02]))
    buf[i + 3] = key.sf & 0xff
    buf[i + 4] = key.minor ? 1 : 0
  }
  return new Uint8Array(buf)
}

/**
 * "찾은 음이 악보에 모두 있는가"를 재는 도구 (음원 분석의 100% 기준).
 * AI가 찾은 음표마다, 악보에서 같은 높이이고 시작 위치가 1칸(16분음표) 이내인 음이 있으면 "옮겨졌다"로 센다.
 * 붙임줄로 이어진 음은 한 음으로 본 재생 시간표(buildTimeline)의 음을 쓴다.
 */
export function transcriptionCoverage(
  found: { startSec: number; durationSec: number; midi: number }[],
  scoreNotes: { midi: number; step: number }[],
  bpm: number,
): { matched: number; total: number; missing: { startSec: number; midi: number }[] } {
  const stepSec = 60 / bpm / 4
  const byPitch = new Map<number, number[]>()
  for (const n of scoreNotes) {
    const list = byPitch.get(n.midi)
    if (list) list.push(n.step)
    else byPitch.set(n.midi, [n.step])
  }
  let matched = 0
  const missing: { startSec: number; midi: number }[] = []
  for (const f of found) {
    const step = Math.round(f.startSec / stepSec)
    if ((byPitch.get(f.midi) ?? []).some((s) => Math.abs(s - step) <= 1)) matched++
    else missing.push({ startSec: f.startSec, midi: f.midi })
  }
  return { matched, total: found.length, missing }
}

/**
 * "찾은 음이 울리는 구간이 악보에 있는가"를 재는 도구 (같은 높이의 이어진 음을 하나로 합친 악보용).
 * 찾은 음의 시작이, 악보에서 같은 높이인 음이 울리는 구간(앞뒤 1칸 여유) 안에 있으면 옮겨졌다고 센다.
 */
export function soundingCoverage(
  found: { startSec: number; durationSec: number; midi: number }[],
  scoreNotes: { midi: number; start: number; duration: number }[],
  bpm: number,
): { matched: number; total: number; missing: { startSec: number; midi: number }[] } {
  const slack = 60 / bpm / 4
  let matched = 0
  const missing: { startSec: number; midi: number }[] = []
  for (const f of found) {
    const ok = scoreNotes.some(
      (s) => s.midi === f.midi && f.startSec >= s.start - slack && f.startSec <= s.start + s.duration + slack,
    )
    if (ok) matched++
    else missing.push({ startSec: f.startSec, midi: f.midi })
  }
  return { matched, total: found.length, missing }
}
