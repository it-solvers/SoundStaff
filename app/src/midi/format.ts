import type { KeySignatureChange, MidiFileInfo, TimeSignatureChange } from './types'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export function formatKey(k: KeySignatureChange): string {
  const name = k.tonic.replace('b', '♭').replace('#', '♯')
  return `${name} ${k.scale === 'minor' ? '단조' : '장조'}`
}

export function formatTimeSignature(t: TimeSignatureChange): string {
  return `${t.numerator}/${t.denominator}`
}

const MIDI_NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
export function formatPitch(midi: number): string {
  return `${MIDI_NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

export interface FileSummary {
  tempo: { text: string; fromFile: boolean }
  timeSignature: { text: string; fromFile: boolean }
  key: { text: string; fromFile: boolean }
}

/** 파일에 정보가 없을 때는 MIDI 표준 기본값(120BPM, 4/4)을 보여주고 "파일에 없음"으로 표시한다. 조성은 기본값을 임의로 정하지 않는다. */
export function summarize(info: MidiFileInfo): FileSummary {
  const t = info.tempos[0]
  const ts = info.timeSignatures[0]
  const ks = info.keySignatures[0]
  const tempoChanges = info.tempos.length > 1 ? ` (변화 ${info.tempos.length - 1}회)` : ''
  const tsChanges = info.timeSignatures.length > 1 ? ` (변화 ${info.timeSignatures.length - 1}회)` : ''
  return {
    tempo: t
      ? { text: `${Math.round(t.bpm * 10) / 10} BPM${tempoChanges}`, fromFile: true }
      : { text: '120 BPM', fromFile: false },
    timeSignature: ts
      ? { text: `${formatTimeSignature(ts)}${tsChanges}`, fromFile: true }
      : { text: '4/4', fromFile: false },
    key: ks ? { text: formatKey(ks), fromFile: true } : { text: '정보 없음', fromFile: false },
  }
}
