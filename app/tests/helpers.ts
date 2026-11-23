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
