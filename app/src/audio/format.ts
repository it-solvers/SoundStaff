export const MIDI_EXTENSIONS = ['mid', 'midi']
/** 기획서 11.3장: 지원하는 형식 mid, midi, mp3, wav, m4a, ogg, flac */
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg', 'flac']

/** 기획서 6장: 음원 50MB, 길이 우선 10분 (성능 시험 후 조정) */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024
export const MAX_AUDIO_SECONDS = 10 * 60

export type FileKind = 'midi' | 'audio' | 'unknown'

export function kindOfFile(name: string): FileKind {
  const ext = /\.([^.]+)$/.exec(name)?.[1].toLowerCase() ?? ''
  if (MIDI_EXTENSIONS.includes(ext)) return 'midi'
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio'
  return 'unknown'
}
