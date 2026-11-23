import { tonicName } from '../midi/keys'
import type { AudioNote, MidiFileInfo } from '../midi/types'
import { t } from '../text/ko'
import type { KeyGuess } from './key'
import type { Estimate } from './types'

export const AUDIO_PPQ = 480

let seq = 0

export interface AudioResult {
  fileName: string
  size: number
  durationSec: number
  notes: AudioNote[]
  detectedCount: number
  bpm: Estimate<number>
  key: Estimate<KeyGuess>
  backend: string
  elapsedMs: number
}

/** 음표의 초 단위 위치를 지금 템포의 틱으로 환산한다 (템포를 바꾸면 박 위치가 달라지기 때문) */
export function toNoteEvents(notes: AudioNote[], bpm: number) {
  const ticksPerSec = (bpm / 60) * AUDIO_PPQ
  return notes.map((n) => ({
    ticks: Math.round(n.startSec * ticksPerSec),
    durationTicks: Math.max(1, Math.round(n.durationSec * ticksPerSec)),
    midi: n.midi,
    velocity: n.velocity,
  }))
}

/**
 * 음원 분석 결과를 MIDI 파일과 같은 모양(MidiFileInfo)으로 바꾼다.
 * 그러면 이후(양자화 → 마디 → MusicXML → 미리보기 → 내려받기)는 MIDI 경로와 똑같이 처리된다. (기획서 8.5장 5번)
 * 템포·조성은 추정값이고, 박자는 파일에 정보가 없으므로 비워 두어 4/4 기본값을 쓴다.
 */
export function audioToInfo(r: AudioResult): MidiFileInfo {
  const pitches = r.notes.map((n) => n.midi)
  return {
    id: `audio-${Date.now()}-${seq++}`,
    source: 'audio',
    fileName: r.fileName.normalize('NFC'),
    size: r.size,
    ppq: AUDIO_PPQ,
    durationSec: r.durationSec,
    tempos: [{ ticks: 0, bpm: r.bpm.value }],
    timeSignatures: [],
    keySignatures: [
      {
        ticks: 0,
        fifths: r.key.value.fifths,
        scale: r.key.value.mode,
        tonic: tonicName(r.key.value.fifths, r.key.value.mode),
      },
    ],
    tracks: [
      {
        index: 0,
        name: t.audio.trackName,
        instrumentName: 'acoustic grand piano',
        instrumentNumber: 0,
        channel: 1,
        noteCount: r.notes.length,
        kind: r.notes.length ? 'pitched' : 'empty',
        lowestMidi: pitches.length ? Math.min(...pitches) : undefined,
        highestMidi: pitches.length ? Math.max(...pitches) : undefined,
        notes: toNoteEvents(r.notes, r.bpm.value),
      },
    ],
    audio: {
      notes: r.notes,
      detectedCount: r.detectedCount,
      bpmConfidence: r.bpm.confidence,
      keyConfidence: r.key.confidence,
      backend: r.backend,
      elapsedMs: r.elapsedMs,
    },
  }
}
