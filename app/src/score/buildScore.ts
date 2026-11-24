import { layoutTrack } from '../midi/measures'
import { buildMeasureGrid, enforceMonophonic, quantizeNotes, type MeasureGrid, type QNote } from '../midi/quantize'
import type { MidiFileInfo, TrackInfo } from '../midi/types'
import { t } from '../text/ko'
import { UserError } from '../utils/errors'
import { baseName as baseNameOf } from '../utils/fileName'
import { materializeAudio } from './audioInfo'
import { applySettings } from './settings'
import { toMusicXml } from './toMusicXml'
import type { BuildResult, PartModel, PartReport, ScoreModel, ScoreSettings } from './types'
import { validateModel, validateXmlWellFormed } from './validate'

/** MIDI 파일에서 읽은 값으로 기본 설정을 만든다 (사용자가 바꾼 값이 있으면 applySettings를 쓴다) */
export const defaultSettings = (info: MidiFileInfo): ScoreSettings => applySettings(info)

export const baseName = baseNameOf

function trackName(t: TrackInfo): string {
  return t.name || t.instrumentName || `트랙 ${t.index + 1}`
}

function pickClef(notes: QNote[]): 'G' | 'F' {
  if (!notes.length) return 'G'
  const avg = notes.reduce((a, n) => a + n.midi, 0) / notes.length
  return avg < 54 ? 'F' : 'G'
}

interface Prepared {
  warnings: string[]
  excludedDrums: string[]
  tracks: { track: TrackInfo; notes: QNote[] }[]
  grid: MeasureGrid
  tempoByMeasure: Map<number, number>
}

/** 두 변환 방식이 공통으로 거치는 단계: 트랙 선별 → 양자화 → 마디 구성 → 템포 배치 */
function prepare(info: MidiFileInfo, settings: ScoreSettings, extraSteps = 0): Prepared {
  const warnings: string[] = []
  const pitched = info.tracks.filter((t) => t.kind === 'pitched')
  const excludedDrums = info.tracks.filter((t) => t.kind === 'drum').map((t) => t.name || '드럼')
  if (!pitched.length) {
    const anyNotes = info.tracks.some((tr) => tr.noteCount > 0)
    throw new UserError(anyNotes ? t.errors.noPitched : t.errors.noNotes)
  }

  let offGrid = 0
  let noteTotal = 0
  const tracks = pitched.map((t) => {
    const q = quantizeNotes(t.notes, info.ppq)
    offGrid += q.offGrid
    noteTotal += t.notes.length
    // 음원 분석 결과는 주 멜로디 한 줄이므로, 칸에 맞춘 뒤에도 겹치는 음이 없게 보장한다
    return { track: t, notes: info.source === 'audio' ? enforceMonophonic(q.notes) : q.notes }
  })
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

  return { warnings, excludedDrums, tracks, grid, tempoByMeasure }
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

/** 악기별 악보: 음높이 트랙마다 한 단. 드럼·빈 트랙은 제외한다. */
export function buildInstrumentScore(info: MidiFileInfo, settings: ScoreSettings): BuildResult {
  const p = prepare(info, settings)
  const warnings = [...p.warnings]
  const parts: PartModel[] = []
  const partReports: PartReport[] = []

  p.tracks.forEach(({ track, notes }, i) => {
    const layout = layoutTrack(notes, p.grid.measures)
    warnings.push(...layout.warnings.map((w) => t.warnings.track(trackName(track), w)))
    parts.push({
      id: `P${i + 1}`,
      name: trackName(track),
      instrumentName: track.instrumentName || 'piano',
      channel: track.channel,
      program: track.instrumentNumber,
      // 음원 분석 결과(주 멜로디)는 항상 높은음자리표 한 단이다 (기획서 8.5장 7번)
      staves: [{ clef: info.source === 'audio' ? 'G' : pickClef(notes), layout: layout.measures }],
    })
    partReports.push({
      name: trackName(track),
      noteCount: track.noteCount,
      maxVoices: Math.max(1, ...layout.measures.map((vs) => vs.length)),
    })
  })
  if (p.excludedDrums.length) warnings.push(t.warnings.drumsExcluded(p.excludedDrums.length))

  const model: ScoreModel = {
    title: settings.title,
    composer: settings.composer,
    key: settings.key,
    grid: p.grid.measures,
    tempoByMeasure: p.tempoByMeasure,
    parts,
  }
  return finish(model, { parts: partReports, excludedDrums: p.excludedDrums, warnings })
}

export function buildScore(info: MidiFileInfo, settings: ScoreSettings): BuildResult {
  // 음원 분석 결과는 지금 템포로 박 위치를 환산한 뒤, 악기(트랙)마다 한 단씩 악보를 만든다
  return buildInstrumentScore(materializeAudio(info, settings), settings)
}
