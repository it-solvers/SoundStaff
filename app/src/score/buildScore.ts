import { fitMinorToVoices, layoutPercussion, layoutTrack, selectMainNotes, splitIntoLayers } from '../midi/measures'
import { drumSound } from '../midi/percussion'
import {
  buildMeasureGrid,
  enforceMonophonic,
  quantizeNotes,
  simplifyToChords,
  tidyForEditing,
  type MeasureGrid,
  type QNote,
} from '../midi/quantize'
import type { MidiFileInfo, TrackInfo } from '../midi/types'
import { t } from '../text'
import { UserError } from '../utils/errors'
import { baseName as baseNameOf } from '../utils/fileName'
import { materializeAudio } from './audioInfo'
import { applySettings } from './settings'
import { orderBy } from './trackOrder'
import { toMusicXml } from './toMusicXml'
import type { BuildResult, PartModel, PartReport, ScoreModel, ScoreSettings, StaffModel } from './types'
import { validateModel, validateXmlWellFormed } from './validate'

/** MIDI 파일에서 읽은 값으로 기본 설정을 만든다 (사용자가 바꾼 값이 있으면 applySettings를 쓴다) */
export const defaultSettings = (info: MidiFileInfo): ScoreSettings => applySettings(info)

export const baseName = baseNameOf

function trackName(track: TrackInfo): string {
  if (track.kind === 'drum') return track.name || t.files.drum
  return track.name || track.instrumentName || t.files.trackNumber(track.index + 1)
}

function pickClef(notes: QNote[]): 'G' | 'F' {
  if (!notes.length) return 'G'
  const avg = notes.reduce((a, n) => a + n.midi, 0) / notes.length
  return avg < 54 ? 'F' : 'G'
}

interface Prepared {
  warnings: string[]
  tracks: { track: TrackInfo; notes: QNote[] }[]
  grid: MeasureGrid
  tempoByMeasure: Map<number, number>
}

/** 두 변환 방식이 공통으로 거치는 단계: 트랙 선별 → 양자화 → 마디 구성 → 템포 배치 */
function prepare(info: MidiFileInfo, settings: ScoreSettings, extraSteps = 0): Prepared {
  const warnings: string[] = []
  const playable = info.tracks.filter((t) => t.kind !== 'empty')
  // 사용자가 악보에서 뺀 악기는 처음부터 없는 것으로 친다 (마디 수·경고·악보·재생·PDF·MusicXML 모두)
  const removed = new Set(settings.excludedTracks ?? [])
  const kept = playable.filter((t) => !removed.has(t.index))
  if (playable.length && !kept.length) throw new UserError(t.errors.allRemoved)
  const pitched = kept.filter((t) => t.kind === 'pitched')
  // 타악기는 GM 번호가 있는 음만 적는다. 자리를 모르는 음은 빼고 알린다
  let unknownDrums = 0
  const drums = kept
    .filter((t) => t.kind === 'drum')
    .map((track) => {
      const known = track.notes.filter((n) => drumSound(n.midi))
      unknownDrums += track.notes.length - known.length
      return { track, known }
    })
    .filter((d) => d.known.length)
  if (!pitched.length && !drums.length) throw new UserError(t.errors.noNotes)
  if (unknownDrums) warnings.push(t.warnings.unknownDrums(unknownDrums))

  let offGrid = 0
  let noteTotal = 0
  let trimmed = 0 // 들리는 대로 악보에서 정리되어 악보에 남지 않은 음의 수 (칸에 맞추며 합친 음 + 화음 정리로 뺀 음)
  const tracks = pitched.map((t) => {
    const q = quantizeNotes(t.notes, info.ppq)
    offGrid += q.offGrid
    noteTotal += t.notes.length
    // 음원 분석 결과는 칸에 맞춘 뒤에도 읽기 쉽게 정리한다: 멜로디는 겹치는 음이 없는 한 줄, 들리는 대로 악보는 겹치지 않는 화음의 나열
    // 들리는 대로: 기본은 찾은 음을 하나도 빼지 않고(겹치는 음은 여러 성부로) 적는다. 선택하면 읽기 쉽게 정리한다.
    const notes =
      info.source !== 'audio'
        ? q.notes
        : t.chords
          ? settings.audioSimplify
            ? settings.audioEdit
              ? tidyForEditing(q.notes, settings.audioMerge !== false, settings.editTuning) // 편집용: 같은 음은 이어 붙이고 한 보표에 한 성부(화음)로 단순하게
              : settings.audioEmphasis === false
                ? simplifyToChords(q.notes)
                : // 주된 음은 길이를 지키고(겹치면 성부로 나눠 적는다) 덜 주된 음(회색)만 한 성부 화음으로 단순화한다: 주된 음이 돋보인다
                  (() => {
                    const marked = selectMainNotes(q.notes) // 주된 음을 성부 3개 안에 자리 잡아 주고 나머지는 회색으로
                    return fitMinorToVoices([
                      ...marked.filter((n) => !n.minor),
                      ...simplifyToChords(marked.filter((n) => n.minor)),
                    ])
                  })()
            : q.notes
          : enforceMonophonic(q.notes)
    if (t.chords) trimmed += t.notes.length - notes.length
    return { track: t, notes }
  })
  for (const { track, known } of drums) {
    const q = quantizeNotes(known, info.ppq)
    offGrid += q.offGrid
    noteTotal += known.length
    // 타악기는 친 위치만 의미가 있다 (길이는 마디 배치에서 정한다)
    tracks.push({ track, notes: q.notes.map((n) => ({ ...n, end: n.start + 1 })) })
  }
  // 파일의 트랙 순서대로 단을 쌓는다
  tracks.sort((a, b) => a.track.index - b.track.index)
  const mergedCount = info.audio?.mergedCount ?? 0
  if (mergedCount > 0) warnings.push(t.warnings.notesMerged(mergedCount, info.audio?.allNotes.length ?? 0))
  if (trimmed > 0) {
    warnings.push(
      settings.audioSimplify
        ? t.warnings.chordsTrimmed(trimmed, noteTotal)
        : t.warnings.chordsDeduped(trimmed, noteTotal),
    )
  }
  if (noteTotal > 0 && offGrid / noteTotal > 0.1) {
    warnings.push(t.warnings.offGrid(Math.round((offGrid / noteTotal) * 100)))
  }

  const totalSteps = Math.max(...tracks.map((q) => q.notes.reduce((m, n) => Math.max(m, n.end), 0))) + extraSteps
  const grid = buildMeasureGrid(settings.timeSignatures, info.ppq, totalSteps)
  warnings.push(...grid.warnings)

  // 템포는 가장 가까운 마디 시작에 배치한다
  const tempoByMeasure = new Map<number, number>()
  const gStep = info.ppq / 4
  let snapped = 0
  const tempos = [...settings.tempos].sort((a, b) => a.ticks - b.ticks)
  for (const t of tempos) {
    const step = t.ticks / gStep
    let best = 0
    grid.measures.forEach((m, i) => {
      if (Math.abs(m.startStep - step) < Math.abs(grid.measures[best].startStep - step)) best = i
    })
    if (Math.abs(grid.measures[best].startStep - step) > 0.5) snapped++
    tempoByMeasure.set(best, Math.round(t.bpm * 100) / 100)
  }
  if (snapped) warnings.push(t.warnings.snappedTempo(snapped))
  if (!tempoByMeasure.has(0)) tempoByMeasure.set(0, tempos[0] ? Math.round(tempos[0].bpm * 100) / 100 : 120)

  return { warnings, tracks, grid, tempoByMeasure }
}

/** 모델 검증 → XML 생성 → XML 형식 검증 */
function finish(model: ScoreModel, base: Omit<BuildResult['report'], 'measureCount'>): BuildResult {
  const v = validateModel(model)
  if (!v.ok) throw new UserError(t.errors.structure(v.errors.slice(0, 3).join(' / ')))
  const xml = toMusicXml(model)
  const x = validateXmlWellFormed(xml)
  if (!x.ok) throw new UserError(x.errors.join(' '))
  return { xml, model, report: { ...base, measureCount: model.grid.length } }
}

/** 악기별 악보: 트랙마다 한 단 (타악기 트랙은 타악기 보표). 빈 트랙은 제외한다. */
export function buildInstrumentScore(info: MidiFileInfo, settings: ScoreSettings): BuildResult {
  const p = prepare(info, settings)
  const warnings = [...p.warnings]
  const parts: PartModel[] = []
  const partReports: PartReport[] = []

  const muted = new Set(settings.mutedTracks ?? [])
  // 음원 "들리는 대로" + 읽기 쉽게 정리: 오른손·왼손을 한 파트의 두 보표(피아노 대보표)로 묶는다. 순서는 오른손(높은음자리표) → 왼손(낮은음자리표)로 고정.
  const grand =
    info.source === 'audio' &&
    settings.audioMode !== 'melody' &&
    !!settings.audioSimplify &&
    p.tracks.every((x) => x.track.chords)
  if (grand) {
    const hands = [...p.tracks].sort((a, b) => a.track.index - b.track.index)
    const staves: StaffModel[] = []
    let noteCount = 0
    let maxVoices = 1
    for (const { track, notes } of hands) {
      const layout = layoutTrack(notes, p.grid.measures, { relaxed: !!settings.audioEdit })
      warnings.push(...layout.warnings.map((w) => t.warnings.track(trackName(track), w)))
      staves.push({ clef: track.clef ?? pickClef(notes), layout: layout.measures, muted: muted.has(track.index) })
      noteCount += track.noteCount
      maxVoices = Math.max(maxVoices, ...layout.measures.map((vs) => vs.length))
    }
    parts.push({
      id: 'P1',
      name: t.audio.trackSingle,
      instrumentName: 'Acoustic Grand Piano',
      channel: 1,
      program: 0,
      staves,
    })
    partReports.push({ name: t.audio.trackSingle, noteCount, maxVoices })
  }
  // 사용자가 정한 순서가 있으면 그 순서로 단을 쌓는다
  if (!grand)
    orderBy(p.tracks, (x) => x.track.index, settings.trackOrder).forEach(({ track, notes }) => {
      if (track.kind === 'drum') {
        const name = trackName(track)
        const layout = layoutPercussion(notes, p.grid.measures, (midi) => !!drumSound(midi)?.foot)
        parts.push({
          id: `P${parts.length + 1}`,
          name,
          instrumentName: name,
          channel: 10,
          program: 0,
          staves: [{ clef: 'percussion', layout }],
          percussion: true,
          muted: muted.has(track.index),
        })
        partReports.push({ name, noteCount: notes.length, maxVoices: Math.max(1, ...layout.map((vs) => vs.length)) })
        return
      }
      // 음원 "들리는 대로": 한 단에 4성부가 넘는 음은 줄이지 않고 같은 음자리표의 추가 단("오른손 2" 등)으로 나눈다
      const layered = info.source === 'audio' && !!track.chords && !settings.audioSimplify
      const layers = layered ? splitIntoLayers(notes) : [notes]
      layers.forEach((layerNotes, l) => {
        const name = l === 0 ? trackName(track) : `${trackName(track)} ${l + 1}`
        const layout = layoutTrack(layerNotes, p.grid.measures, { legatoTrim: !layered }) // 층은 이미 정리를 마쳤으므로 다시 하지 않는다
        warnings.push(...layout.warnings.map((w) => t.warnings.track(name, w)))
        parts.push({
          id: `P${parts.length + 1}`,
          name,
          instrumentName: track.instrumentName || 'piano',
          channel: track.channel,
          program: track.instrumentNumber,
          staves: [{ clef: track.clef ?? pickClef(layerNotes), layout: layout.measures }],
          muted: muted.has(track.index),
        })
        partReports.push({
          name,
          noteCount: layers.length > 1 ? layerNotes.length : track.noteCount,
          maxVoices: Math.max(1, ...layout.measures.map((vs) => vs.length)),
        })
      })
    })

  const model: ScoreModel = {
    title: settings.title,
    composer: settings.composer,
    key: settings.key,
    grid: p.grid.measures,
    tempoByMeasure: p.tempoByMeasure,
    parts,
  }
  return finish(model, { parts: partReports, warnings })
}

export function buildScore(info: MidiFileInfo, settings: ScoreSettings): BuildResult {
  // 음원 분석 결과는 지금 템포로 박 위치를 환산한 뒤, 악기(트랙)마다 한 단씩 악보를 만든다
  return buildInstrumentScore(materializeAudio(info, settings), settings)
}
