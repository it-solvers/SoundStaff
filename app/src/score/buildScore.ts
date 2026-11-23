import { layoutTrack } from '../midi/measures'
import { buildMeasureGrid, quantizeNotes, type QNote } from '../midi/quantize'
import type { MidiFileInfo, TrackInfo } from '../midi/types'
import { toMusicXml } from './toMusicXml'
import type { BuildResult, PartModel, PartReport, ScoreModel, ScoreSettings } from './types'
import { validateModel, validateXmlWellFormed } from './validate'

/** MIDI 파일에서 읽은 값으로 기본 설정을 만든다. 파일에 없으면 MIDI 표준 기본값(120BPM, 4/4)과 C장조를 쓴다. */
export function defaultSettings(info: MidiFileInfo): ScoreSettings {
  const k = info.keySignatures[0]
  return {
    tempos: info.tempos.length ? info.tempos : [{ ticks: 0, bpm: 120 }],
    timeSignatures: info.timeSignatures.length ? info.timeSignatures : [{ ticks: 0, numerator: 4, denominator: 4 }],
    key: k ? { fifths: k.fifths, mode: k.scale } : { fifths: 0, mode: 'major' },
  }
}

function pickClef(notes: QNote[]): 'G' | 'F' {
  if (!notes.length) return 'G'
  const avg = notes.reduce((a, n) => a + n.midi, 0) / notes.length
  return avg < 54 ? 'F' : 'G'
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

/** 한 MIDI 파일의 음높이 트랙을 악기별 악보(트랙마다 한 단)로 만든다. 드럼·빈 트랙은 제외한다. */
export function buildInstrumentScore(info: MidiFileInfo, settings: ScoreSettings): BuildResult {
  const warnings: string[] = []
  const pitched = info.tracks.filter((t) => t.kind === 'pitched')
  const excludedDrums = info.tracks.filter((t) => t.kind === 'drum').map((t) => t.name || '드럼')
  if (!pitched.length) throw new Error('악보로 만들 음높이 트랙이 없습니다. (드럼 또는 빈 트랙만 있음)')

  // 1) 양자화
  let offGrid = 0
  let noteTotal = 0
  const quantized = pitched.map((t) => {
    const q = quantizeNotes(t.notes, info.ppq)
    offGrid += q.offGrid
    noteTotal += t.notes.length
    return { track: t, notes: q.notes }
  })
  if (noteTotal > 0 && offGrid / noteTotal > 0.1) {
    warnings.push(
      `음표의 ${Math.round((offGrid / noteTotal) * 100)}%가 16분음표 격자에서 크게 벗어나 있습니다. 3연음 등은 가장 가까운 16분음표 위치로 맞춰지므로 리듬이 달라질 수 있습니다.`,
    )
  }

  // 2) 마디 구성
  const totalSteps = Math.max(...quantized.map((q) => q.notes.reduce((m, n) => Math.max(m, n.end), 0)))
  const grid = buildMeasureGrid(settings.timeSignatures, info.ppq, totalSteps)
  warnings.push(...grid.warnings)

  // 3) 템포 → 가장 가까운 마디 시작에 배치
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
  if (snapped) warnings.push(`마디 중간에 있는 템포 변화 ${snapped}개를 가장 가까운 마디 시작으로 옮겼습니다.`)
  if (!tempoByMeasure.has(0)) tempoByMeasure.set(0, tempos[0] ? Math.round(tempos[0].bpm * 100) / 100 : 120)

  // 4) 트랙별 성부·마디 배치
  const parts: PartModel[] = []
  const partReports: PartReport[] = []
  quantized.forEach(({ track, notes }, i) => {
    const layout = layoutTrack(notes, grid.measures)
    warnings.push(...layout.warnings.map((w) => `${trackName(track)}: ${w}`))
    parts.push({
      id: `P${i + 1}`,
      name: trackName(track),
      instrumentName: track.instrumentName || 'piano',
      channel: track.channel,
      program: track.instrumentNumber,
      clef: pickClef(notes),
      layout: layout.measures,
    })
    partReports.push({
      name: trackName(track),
      noteCount: track.noteCount,
      maxVoices: Math.max(1, ...layout.measures.map((vs) => vs.length)),
    })
  })

  const model: ScoreModel = { title: baseName(info.fileName), key: settings.key, grid: grid.measures, tempoByMeasure, parts }

  // 5) 생성 + 검증
  const v = validateModel(model)
  if (!v.ok) throw new Error(`악보 구조 검증 실패: ${v.errors.slice(0, 3).join(' / ')}`)
  const xml = toMusicXml(model)
  const x = validateXmlWellFormed(xml)
  if (!x.ok) throw new Error(x.errors.join(' '))

  if (excludedDrums.length) warnings.push(`드럼 트랙 ${excludedDrums.length}개는 악보에서 제외했습니다.`)
  return { xml, model, report: { measureCount: grid.measures.length, parts: partReports, excludedDrums, warnings } }
}

function trackName(t: TrackInfo): string {
  return t.name || t.instrumentName || `트랙 ${t.index + 1}`
}
