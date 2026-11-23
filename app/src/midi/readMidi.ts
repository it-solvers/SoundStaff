import { Midi } from '@tonejs/midi'
import { t } from '../text/ko'
import { classifyTrack } from './classify'
import { MAJOR_BY_FIFTHS, MINOR_BY_FIFTHS } from './keys'
import type { MidiFileInfo, ReadResult, TrackInfo } from './types'

/** 기획서 6장: 파일 크기 상한은 우선 MIDI 5MB (성능 시험 후 조정) */
export const MAX_MIDI_BYTES = 5 * 1024 * 1024

const MIDI_EXTENSION = /\.(mid|midi)$/i

let seq = 0

/**
 * MIDI 텍스트(트랙 이름 등)는 규격상 인코딩이 정해져 있지 않아, 라이브러리가 바이트를 그대로 글자로 바꾼다.
 * 한글 이름이 UTF-8이나 EUC-KR(CP949)로 들어 있으면 깨져 보이므로 복원을 시도하고, 실패하면 원문을 쓴다.
 */
export function decodeMidiText(text: string): string {
  if (!text) return text
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c > 255) return text // 이미 정상적인 유니코드 문자열
    bytes[i] = c
  }
  if (!bytes.some((b) => b > 127)) return text // 순수 ASCII
  for (const enc of ['utf-8', 'euc-kr']) {
    try {
      return new TextDecoder(enc, { fatal: true }).decode(bytes)
    } catch {
      // 다음 인코딩 시도
    }
  }
  return text
}

export async function readMidiFile(file: File): Promise<ReadResult> {
  const fail = (error: string): ReadResult => ({ ok: false, fileName: file.name, error })

  if (!MIDI_EXTENSION.test(file.name)) return fail(t.errors.unsupportedFormat)
  if (file.size === 0) return fail(t.errors.empty)
  if (file.size > MAX_MIDI_BYTES) {
    return fail(t.errors.tooBig((file.size / 1024 / 1024).toFixed(1), MAX_MIDI_BYTES / 1024 / 1024))
  }

  let midi: Midi
  try {
    midi = new Midi(await file.arrayBuffer())
  } catch {
    return fail(t.errors.unreadable)
  }

  const tracks: TrackInfo[] = midi.tracks.map((t, index) => {
    const noteCount = t.notes.length
    const pitches = t.notes.map((n) => n.midi)
    return {
      index,
      name: decodeMidiText(t.name).trim(),
      instrumentName: t.instrument.name,
      instrumentNumber: t.instrument.number,
      channel: t.channel + 1,
      noteCount,
      kind: classifyTrack({ channelIndex: t.channel, percussion: t.instrument.percussion, noteCount }),
      lowestMidi: noteCount ? Math.min(...pitches) : undefined,
      highestMidi: noteCount ? Math.max(...pitches) : undefined,
      notes: t.notes.map((n) => ({
        ticks: n.ticks,
        durationTicks: n.durationTicks,
        midi: n.midi,
        velocity: n.velocity,
      })),
    }
  })

  const h = midi.header
  const info: MidiFileInfo = {
    id: `${Date.now()}-${seq++}`,
    fileName: file.name,
    size: file.size,
    ppq: h.ppq,
    durationSec: midi.duration,
    tempos: h.tempos.map((t) => ({ ticks: t.ticks, bpm: t.bpm })),
    timeSignatures: h.timeSignatures.map((t) => ({
      ticks: t.ticks,
      numerator: t.timeSignature[0],
      denominator: t.timeSignature[1],
    })),
    // 비정상 값(조표 범위를 벗어난 파일)은 "정보 없음"으로 취급한다.
    keySignatures: h.keySignatures.flatMap((k) => {
      const idx = MAJOR_BY_FIFTHS.indexOf(k.key)
      if (idx < 0) return []
      const scale = k.scale === 'minor' ? ('minor' as const) : ('major' as const)
      return [
        { ticks: k.ticks, fifths: idx - 7, scale, tonic: (scale === 'minor' ? MINOR_BY_FIFTHS : MAJOR_BY_FIFTHS)[idx] },
      ]
    }),
    tracks,
  }
  return { ok: true, info }
}
