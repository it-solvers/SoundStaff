import { tonicName } from '../midi/keys'
import type { AudioNote, MidiFileInfo, TrackInfo } from '../midi/types'
import type { AudioMode } from '../score/types'
import { t } from '../text'
import type { KeyGuess } from './key'
import { resolveEditTuning, type EditTuning } from './editTuning'
import {
  MERGE_GAP_SECONDS,
  dropBackgroundNotes,
  dropOctaveHarmonics,
  markMinorNotes,
  mergeRepeatedNotes,
} from './notes'
import { beatPosition, tempoMarks } from './beats'
import type { Estimate } from './types'

export const AUDIO_PPQ = 480

let seq = 0

export interface AudioResult {
  fileName: string
  size: number
  durationSec: number
  /** 주 멜로디만 골라낸 한 줄 선율 */
  notes: AudioNote[]
  /** 거르기를 마친 모든 음표 (없으면 멜로디와 같다) */
  allNotes?: AudioNote[]
  detectedCount: number
  refinedAdded?: number
  refinedRemoved?: number
  bpm: Estimate<number>
  /** 추적한 박의 시각(초). 있으면 연주가 느려지거나 빨라지는 것을 따라가 박 위치를 정한다 (일정한 템포면 없다) */
  beatTimes?: number[]
  key: Estimate<KeyGuess>
  backend: string
  elapsedMs: number
}

/** 음표의 초 단위 위치를 지금 템포의 틱으로 환산한다 (템포를 바꾸면 박 위치가 달라지기 때문) */
export function toNoteEvents(notes: AudioNote[], bpm: number, beatTimes?: number[]) {
  if (beatTimes) {
    // 박 지도: 시각을 박 위치로 바꿔서 연주가 느려지거나 빨라져도 박에 맞는다
    return notes.map((n) => {
      const s = beatPosition(beatTimes, n.startSec)
      const e = beatPosition(beatTimes, n.startSec + n.durationSec)
      return {
        ticks: Math.max(0, Math.round(s * AUDIO_PPQ)),
        durationTicks: Math.max(1, Math.round((e - s) * AUDIO_PPQ)),
        midi: n.midi,
        velocity: n.velocity,
        minor: n.minor,
      }
    })
  }
  const ticksPerSec = (bpm / 60) * AUDIO_PPQ
  return notes.map((n) => ({
    ticks: Math.round(n.startSec * ticksPerSec),
    durationTicks: Math.max(1, Math.round(n.durationSec * ticksPerSec)),
    midi: n.midi,
    velocity: n.velocity,
    minor: n.minor,
  }))
}

/** 들리는 대로 악보에서 높은 음(오른손)과 낮은 음(왼손)을 나누는 기준: 가온 도(C4, MIDI 60) 이상은 오른손 */
export const HAND_SPLIT = 60

function makeTrack(
  index: number,
  name: string,
  notes: AudioNote[],
  bpm: number,
  extra: Partial<TrackInfo>,
  beatTimes?: number[],
): TrackInfo {
  const pitches = notes.map((n) => n.midi)
  return {
    index,
    name,
    instrumentName: 'acoustic grand piano',
    instrumentNumber: 0,
    channel: 1,
    noteCount: notes.length,
    kind: notes.length ? 'pitched' : 'empty',
    lowestMidi: pitches.length ? Math.min(...pitches) : undefined,
    highestMidi: pitches.length ? Math.max(...pitches) : undefined,
    notes: toNoteEvents(notes, bpm, beatTimes),
    ...extra,
  }
}

/**
 * 음원 분석 결과로 악보의 단(트랙)을 만든다.
 * - melody(멜로디만): 주 멜로디 한 줄을 높은음자리표 한 단으로.
 * - full(들리는 대로): 찾은 음을 모두 쓰되 악기는 구분할 수 없으므로 가온 도 기준으로 오른손(높은음자리표)·왼손(낮은음자리표) 두 단으로 나눈다.
 *   한쪽에 음이 하나도 없으면 그 단은 만들지 않고, 남은 한 단은 "Piano"로 부른다.
 */
export function audioTracks(
  audio: { notes: AudioNote[]; allNotes?: AudioNote[]; beatTimes?: number[] },
  mode: AudioMode,
  bpm: number,
  merge = true,
  emphasis = true,
  edit = false,
  tuning?: Partial<EditTuning>,
): TrackInfo[] {
  if (mode === 'melody') return [makeTrack(0, t.audio.trackName, audio.notes, bpm, { clef: 'G' }, audio.beatTimes)]
  const found = audio.allNotes ?? audio.notes
  const tn = resolveEditTuning(tuning)
  const merged = merge ? mergeRepeatedNotes(found, edit ? tn.mergeGapSec : MERGE_GAP_SECONDS) : found // 같은 높이로 이어진 음은 하나로 (끄면 AI가 나눈 그대로)
  // 편집용: 뒤에 깔리는 작은 음은 뺀다. 아니면 작고 짧은 음은 회색으로 표시한다
  const all = edit
    ? dropBackgroundNotes(dropOctaveHarmonics(merged, tn.harmonicRatio), tn.dropShare)
    : emphasis
      ? markMinorNotes(merged)
      : merged // 작고 짧은 음은 덜 주된 음으로 표시 (악보에서 회색)
  const right = all.filter((n) => n.midi >= HAND_SPLIT)
  const left = all.filter((n) => n.midi < HAND_SPLIT)
  const both = right.length > 0 && left.length > 0
  const tracks: TrackInfo[] = []
  // 번호는 항상 오른손 0, 왼손 1로 고정해서 악기 설정(순서·소리 끄기·빼기)이 흔들리지 않게 한다
  if (right.length)
    tracks.push(
      makeTrack(
        0,
        both ? t.audio.trackRight : t.audio.trackSingle,
        right,
        bpm,
        { clef: 'G', chords: true },
        audio.beatTimes,
      ),
    )
  if (left.length)
    tracks.push(
      makeTrack(
        1,
        both ? t.audio.trackLeft : t.audio.trackSingle,
        left,
        bpm,
        { clef: 'F', chords: true },
        audio.beatTimes,
      ),
    )
  return tracks.length ? tracks : [makeTrack(0, t.audio.trackName, [], bpm, { clef: 'G' }, audio.beatTimes)]
}

/**
 * 음원 분석 결과를 MIDI 파일과 같은 모양(MidiFileInfo)으로 바꾼다.
 * 그러면 이후(양자화 → 마디 → MusicXML → 미리보기 → 내려받기)는 MIDI 경로와 똑같이 처리된다. (기획서 8.5장 5번)
 * 템포·조성은 추정값이고, 박자는 파일에 정보가 없으므로 비워 두어 4/4 기본값을 쓴다.
 * 악보의 단은 기본 방식(들리는 대로)으로 만들어 두고, 방식을 바꾸면 materializeAudio가 다시 만든다.
 */
export function audioToInfo(r: AudioResult): MidiFileInfo {
  return {
    id: `audio-${Date.now()}-${seq++}`,
    source: 'audio',
    fileName: r.fileName.normalize('NFC'),
    size: r.size,
    ppq: AUDIO_PPQ,
    durationSec: r.durationSec,
    tempos: r.beatTimes
      ? tempoMarks(r.beatTimes).map((m) => ({ ticks: m.beat * AUDIO_PPQ, bpm: m.bpm }))
      : [{ ticks: 0, bpm: r.bpm.value }],
    timeSignatures: [],
    keySignatures: [
      {
        ticks: 0,
        fifths: r.key.value.fifths,
        scale: r.key.value.mode,
        tonic: tonicName(r.key.value.fifths, r.key.value.mode),
      },
    ],
    tracks: audioTracks(r, 'full', r.bpm.value, true, true),
    audio: {
      notes: r.notes,
      allNotes: r.allNotes ?? r.notes,
      beatTimes: r.beatTimes,
      detectedCount: r.detectedCount,
      refinedAdded: r.refinedAdded ?? 0,
      refinedRemoved: r.refinedRemoved ?? 0,
      bpmConfidence: r.bpm.confidence,
      keyConfidence: r.key.confidence,
      backend: r.backend,
      elapsedMs: r.elapsedMs,
    },
  }
}
