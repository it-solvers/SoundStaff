import { defaultAudioMode } from './audioInfo'
import type { EditTuning } from '../audio/editTuning'
import { MAJOR_BY_FIFTHS, accidentalsLabel, prettyTonic, tonicName, type KeyMode } from '../midi/keys'
import type { MidiFileInfo } from '../midi/types'
import { baseName } from '../utils/fileName'
import { t } from '../text'
import type { AudioMode, ScoreSettings } from './types'

/** 사용자가 입력 칸에서 바꾼 값. 값이 없으면(undefined) MIDI 파일의 값을 쓴다. */
export interface SettingsOverride {
  title?: string
  composer?: string
  tempo?: number
  beats?: number
  beatType?: number
  key?: { fifths: number; mode: KeyMode }
  /** 음원 분석 결과의 악보 방식 */
  audioMode?: AudioMode
  /** 읽기 쉽게 정리 (일부 음이 빠질 수 있음) */
  audioSimplify?: boolean
  /** 같은 높이로 이어진 음 합치기 */
  audioMerge?: boolean
  /** 고치기 쉽게(Finale 편집용) 정리 */
  audioEdit?: boolean
  /** 편집용 정리의 조정값 (시험·조정용) */
  editTuning?: Partial<EditTuning>
  /** MIDI 악보를 읽기 쉽게 정리하기 */
  midiTidy?: boolean
  /** 주된 음 돋보이기 (작고 짧은 음을 회색으로) */
  audioEmphasis?: boolean
  /** 악기(트랙) 단 순서 (트랙 번호 목록) */
  trackOrder?: number[]
  /** 악보에서 뺄 악기(트랙 번호) */
  excludedTracks?: number[]
  /** 재생할 때 소리를 끌 악기(트랙 번호) */
  mutedTracks?: number[]
}

export const TEMPO_MIN = 20
export const TEMPO_MAX = 400
export const BEAT_TYPES = [2, 4, 8, 16]

/** MIDI 파일에서 읽은 값 (입력 칸의 기본값과 안내용). 파일에 없으면 MIDI 표준 기본값(120BPM, 4/4)과 C장조 */
export function fileValues(info: MidiFileInfo) {
  const k = info.keySignatures[0]
  const ts = info.timeSignatures[0]
  return {
    tempo: Math.round((info.tempos[0]?.bpm ?? 120) * 100) / 100,
    beats: ts?.numerator ?? 4,
    beatType: ts?.denominator ?? 4,
    key: k ? { fifths: k.fifths, mode: k.scale } : { fifths: 0, mode: 'major' as KeyMode },
    keyFromFile: !!k,
    title: baseName(info.fileName),
  }
}

/** MIDI 파일 값을 기본으로 하고, 사용자가 바꾼 값만 덮어쓴다. 템포·박자를 직접 입력하면 파일의 변화 정보는 모두 그 값 하나로 바뀐다. */
export function applySettings(info: MidiFileInfo, o: SettingsOverride = {}): ScoreSettings {
  const f = fileValues(info)
  const tempos =
    o.tempo !== undefined ? [{ ticks: 0, bpm: o.tempo }] : info.tempos.length ? info.tempos : [{ ticks: 0, bpm: 120 }]
  const timeSignatures =
    o.beats !== undefined || o.beatType !== undefined
      ? [{ ticks: 0, numerator: o.beats ?? f.beats, denominator: o.beatType ?? f.beatType }]
      : info.timeSignatures.length
        ? info.timeSignatures
        : [{ ticks: 0, numerator: 4, denominator: 4 }]
  return {
    tempos,
    timeSignatures,
    key: o.key ?? f.key,
    title: o.title?.trim() ? o.title.normalize('NFC').trim() : f.title,
    composer: o.composer?.normalize('NFC').trim() ?? '',
    midiTidy: o.midiTidy ?? true,
    audioMode: o.audioMode ?? defaultAudioMode(info),
    audioSimplify: o.audioSimplify ?? true,
    audioMerge: o.audioMerge ?? true,
    audioEdit: o.audioEdit ?? true,
    editTuning: o.editTuning,
    audioEmphasis: o.audioEmphasis ?? true,
    trackOrder: o.trackOrder,
    excludedTracks: o.excludedTracks,
    mutedTracks: o.mutedTracks,
  }
}

export function isValidTempo(n: number): boolean {
  return Number.isFinite(n) && n >= TEMPO_MIN && n <= TEMPO_MAX
}

/**
 * 음원 분석은 같은 박을 절반이나 두 배 템포로 잘못 읽는 일이 있다(70↔140). 지금 템포의 절반·두 배 후보를 돌려준다.
 * 허용 범위(TEMPO_MIN~TEMPO_MAX)를 벗어나는 쪽은 null이다. 소수는 반올림한다.
 */
export function tempoAlternatives(bpm: number): { half: number | null; double: number | null } {
  const ok = (n: number) => (isValidTempo(Math.round(n)) ? Math.round(n) : null)
  if (!Number.isFinite(bpm)) return { half: null, double: null }
  return { half: ok(bpm / 2), double: ok(bpm * 2) }
}

export function isValidBeats(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 32
}

export interface KeyOption {
  value: string
  fifths: number
  mode: KeyMode
  label: string
}

/** 입력 칸의 조성 목록: 장조 15개 + 단조 15개 */
export const KEY_OPTIONS: KeyOption[] = (['major', 'minor'] as KeyMode[]).flatMap((mode) =>
  MAJOR_BY_FIFTHS.map((_, i) => {
    const fifths = i - 7
    return {
      value: `${mode === 'major' ? 'M' : 'm'}:${fifths}`,
      fifths,
      mode,
      label: `${prettyTonic(tonicName(fifths, mode))} ${mode === 'major' ? t.settings.keyMajor : t.settings.keyMinor} (${accidentalsLabel(fifths)})`,
    }
  }),
)

export const keyValue = (k: { fifths: number; mode: KeyMode }) => `${k.mode === 'major' ? 'M' : 'm'}:${k.fifths}`

export function describeKey(k: { fifths: number; mode: KeyMode }): string {
  return KEY_OPTIONS.find((o) => o.value === keyValue(k))?.label ?? ''
}
