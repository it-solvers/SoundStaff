import {
  fitMinorToVoices,
  fitToVoices,
  layoutPercussion,
  layoutTrack,
  layoutTwoVoices,
  selectMainNotes,
} from '../midi/measures'
import { drumSound } from '../midi/percussion'
import {
  buildMeasureGrid,
  enforceMonophonic,
  quantizeNotes,
  simplifyToChords,
  tidyForEditing,
  toSingleVoice,
  type MeasureGrid,
  type QNote,
} from '../midi/quantize'
import type { MidiFileInfo, NoteEvent, TrackInfo } from '../midi/types'
import { t } from '../text'
import { UserError } from '../utils/errors'
import { baseName as baseNameOf } from '../utils/fileName'
import { findTripletBeats, snapThird, tripletsAllowed } from '../midi/triplets'
import { materializeAudio } from './audioInfo'
import { findRolls, limitHands, rollHits } from './drumPlay'
import { groupDrums } from './drumStaves'
import { isAcousticGuitar, splitThumb } from './guitar'
import { splitHands } from './hands'
import {
  SPLIT_MIDI,
  isKeyboard,
  measureOttava,
  needsTwoStaves,
  ottavaFor,
  pickClef,
  staffClef,
  type Ottava,
  type StaffClef,
} from './notation'
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

/** 두 보표로 나누기: 건반악기는 손의 흐름을 따라, 그 밖(합주 현악 등)은 가운데 도에서 */
function twoStaves(program: number, notes: QNote[]): (StaffClef & { notes: QNote[] })[] {
  const { left, right } = isKeyboard(program)
    ? splitHands(notes)
    : { left: notes.filter((n) => n.midi < SPLIT_MIDI), right: notes.filter((n) => n.midi >= SPLIT_MIDI) }
  return [
    { clef: 'G', octave: 0, notes: right },
    { clef: 'F', octave: 0, notes: left },
  ]
}

interface Prepared {
  warnings: string[]
  /** silent: 타악기 보표에서 재생하지 않을 타격("칸:번호") */
  tracks: { track: TrackInfo; notes: QNote[]; triplets: Set<number>; silent?: Set<string> }[]
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
  // 3연음은 MIDI에서만 찾는다 (음원 분석의 박 위치는 3연음을 가릴 만큼 정확하지 않다)
  const findTriplets = (notes: NoteEvent[]) =>
    info.source !== 'audio' && tripletsAllowed(settings.timeSignatures)
      ? findTripletBeats(notes, info.ppq)
      : new Set<number>()
  let overflow = 0 // 정리를 끈 음원 악보에서 한 손에 담기지 않아 뺀 음 수
  const keepWhatFits = (notes: QNote[]) => {
    const fit = fitToVoices(notes)
    overflow += fit.dropped
    trimmed -= fit.dropped // 같은 칸의 중복 음 알림과 따로 센다
    return fit.notes
  }
  const tracks = pitched.map((t) => {
    const triplets = findTriplets(t.notes)
    const q = quantizeNotes(t.notes, info.ppq, triplets)
    offGrid += q.offGrid
    noteTotal += t.notes.length
    // 음원 분석 결과는 칸에 맞춘 뒤에도 읽기 쉽게 정리한다: 멜로디는 겹치는 음이 없는 한 줄, 들리는 대로 악보는 겹치지 않는 화음의 나열
    // 들리는 대로: 기본은 읽기 쉽게 정리한다. 끄면 음 길이를 그대로 두고 한 손(보표)에 담기지 않는 약한 음만 뺀다.
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
            : keepWhatFits(q.notes)
          : enforceMonophonic(q.notes)
    if (t.chords) trimmed += t.notes.length - notes.length
    return { track: t, notes, triplets, silent: undefined as Set<string> | undefined }
  })
  // 타악기는 친 위치만 의미가 있다 (길이는 마디 배치에서 정한다)
  const tidyDrums = settings.midiTidy !== false
  for (const { known } of drums) {
    const hitsOnly = tidyDrums ? findRolls(known, info.ppq).rest : known // 롤은 박자 칸에 맞는지 따지지 않는다
    offGrid += quantizeNotes(hitsOnly, info.ppq, findTriplets(hitsOnly)).offGrid
    noteTotal += hitsOnly.length
  }
  let rollCount = 0
  let handsDropped = 0
  const muted = new Set(settings.mutedTracks ?? [])
  // 읽기 쉽게 정리: 흩어진 타악기 트랙을 드럼 세트 보표와 손 타악기 보표로 모은다
  const staves =
    settings.midiTidy !== false ? groupDrums(drums) : drums.map((d) => ({ group: undefined, sources: [d] }))
  for (const { group, sources } of staves) {
    // 보표의 자리는 사용자가 정한 순서에서 가장 앞선 원본 트랙의 자리다
    const [first] = orderBy(sources, (s) => s.track.index, settings.trackOrder)
    const original = drums.find((d) => d.track === first.track)!
    // 원본 트랙 하나가 통째로 한 보표가 되면 원래 이름을 쓴다
    const whole = sources.length === 1 && sources[0].known.length === original.known.length
    const name = whole || !group ? trackName(original.track) : group === 'kit' ? t.files.drumSet : t.files.percussion
    // 읽기 쉽게 정리: 아주 빠른 연타는 롤로 적는다
    const split = sources.map((src) => ({
      index: src.track.index,
      ...(tidyDrums ? findRolls(src.known, info.ppq) : { rolls: [], rest: src.known }),
    }))
    // 3연음 박은 보표에 모인 타격 전체로 정하고, 트랙별로 나눠 볼 때도 같은 자리를 쓴다
    const all = split.flatMap((x) => x.rest)
    const triplets = findTriplets(all)
    const hits = (known: NoteEvent[]) => quantizeNotes(known, info.ppq, triplets).notes
    const onsets = new Set(hits(all).map((n) => n.start))
    const perSource = split.map((x) => ({
      index: x.index,
      notes: [...x.rolls.flatMap((r) => rollHits(r, onsets)), ...hits(x.rest)],
    }))
    rollCount += split.reduce((a, x) => a + x.rolls.length, 0)
    // 같은 자리·같은 악기는 하나로 (롤이 앞에 오므로 롤 표시가 남는다)
    const unique = new Map<string, QNote>()
    for (const n of perSource.flatMap((x) => x.notes)) {
      const key = `${n.start}:${n.midi}`
      if (!unique.has(key) || n.roll) unique.set(key, { ...n, end: snapThird(n.start + 1) })
    }
    let notes = [...unique.values()].sort((a, b) => a.start - b.start || b.midi - a.midi)
    if (tidyDrums && group === 'kit') {
      const limited = limitHands(notes, (midi) => !!drumSound(midi)?.foot)
      notes = limited.notes
      handsDropped += limited.dropped
    }
    // 소리 끄기는 원본 트랙 단위다: 끈 트랙만 친 타격은 재생하지 않는다
    const keysOf = (list: typeof perSource) => list.flatMap((x) => x.notes.map((n) => `${n.start}:${n.midi}`))
    const audible = new Set(keysOf(perSource.filter((x) => !muted.has(x.index))))
    const silent = new Set(keysOf(perSource).filter((k) => !audible.has(k)))
    tracks.push({ track: { ...original.track, name }, notes, triplets, silent })
  }
  const combined = drums.length - staves.length
  if (combined > 0) warnings.push(t.warnings.drumsCombined(drums.length, staves.length))
  if (rollCount) warnings.push(t.warnings.drumRolls(rollCount))
  if (handsDropped) warnings.push(t.warnings.drumHands(handsDropped))
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
  if (overflow > 0) warnings.push(t.warnings.voicesDropped(overflow, noteTotal))
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
  // 음원 "들리는 대로": 오른손·왼손을 한 파트의 두 보표(피아노 대보표)로 묶는다. 순서는 오른손(높은음자리표) → 왼손(낮은음자리표)로 고정.
  const grand = info.source === 'audio' && settings.audioMode !== 'melody' && p.tracks.every((x) => x.track.chords)
  if (grand) {
    const hands = [...p.tracks].sort((a, b) => a.track.index - b.track.index)
    const staves: StaffModel[] = []
    let noteCount = 0
    let maxVoices = 1
    for (const { track, notes } of hands) {
      const layout = layoutTrack(notes, p.grid.measures, {
        relaxed: !!settings.audioSimplify && !!settings.audioEdit,
        legatoTrim: !!settings.audioSimplify, // 정리를 끄면 이미 성부에 맞춘 음 길이를 그대로 적는다
      })
      warnings.push(...layout.warnings.map((w) => t.warnings.track(trackName(track), w)))
      staves.push({ clef: track.clef ?? pickClef(notes), layout: layout.measures, muted: muted.has(track.index) })
      noteCount += settings.audioSimplify ? track.noteCount : notes.length
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
    orderBy(p.tracks, (x) => x.track.index, settings.trackOrder).forEach(({ track, notes, triplets, silent }) => {
      if (track.kind === 'drum') {
        const name = trackName(track)
        const layout = layoutPercussion(notes, p.grid.measures, (midi) => !!drumSound(midi)?.foot, triplets)
        parts.push({
          id: `P${parts.length + 1}`,
          name,
          instrumentName: name,
          channel: 10,
          program: 0,
          staves: [{ clef: 'percussion', layout }],
          percussion: true,
          ...(silent?.size ? { silentHits: silent } : {}),
        })
        partReports.push({ name, noteCount: notes.length, maxVoices: Math.max(1, ...layout.map((vs) => vs.length)) })
        return
      }
      if (info.source !== 'audio') {
        const name = trackName(track)
        const program = track.instrumentNumber
        const hands: (StaffClef & { notes: typeof notes })[] = needsTwoStaves(program, notes)
          ? twoStaves(program, notes)
          : [{ ...staffClef(program, notes), notes }]
        const tidy = settings.midiTidy !== false
        let maxVoices = 1
        const staves: StaffModel[] = hands.map((hand) => {
          let layout: ReturnType<typeof layoutTrack>
          if (tidy && isAcousticGuitar(program)) {
            const { upper, lower } = splitThumb(hand.notes, p.grid.measures)
            layout = { measures: layoutTwoVoices(upper, lower, p.grid.measures, triplets), warnings: [] }
          } else
            layout = tidy
              ? layoutTrack(toSingleVoice(hand.notes), p.grid.measures, { relaxed: true, tieCommon: false, triplets })
              : layoutTrack(hand.notes, p.grid.measures, { triplets })
          warnings.push(...layout.warnings.map((w) => t.warnings.track(name, w)))
          maxVoices = Math.max(maxVoices, ...layout.measures.map((vs) => vs.length))
          // 옥타브 점선: 건반악기의 두 보표는 마디마다, 한 보표 악기는 아주 높은 악기만 곡 전체에 붙인다
          const whole = hands.length === 1 ? ottavaFor(hand.notes, hand) : 0
          const ottava: Ottava[] = layout.measures.map((voices) => {
            const midis = voices.flatMap((v) => v.pieces.flatMap((x) => x.midis))
            if (!midis.length) return 0
            return hands.length > 1 && isKeyboard(program) ? measureOttava(midis, hand.clef) : whole
          })
          return {
            clef: hand.clef,
            clefOctave: hand.octave,
            ...(ottava.some(Boolean) ? { ottava } : {}),
            layout: layout.measures,
          }
        })
        parts.push({
          id: `P${parts.length + 1}`,
          name,
          instrumentName: track.instrumentName || 'piano',
          channel: track.channel,
          program,
          staves,
          muted: muted.has(track.index),
        })
        partReports.push({ name, noteCount: track.noteCount, maxVoices })
        return
      }
      // 음원의 멜로디만 악보
      const name = trackName(track)
      const layout = layoutTrack(notes, p.grid.measures)
      warnings.push(...layout.warnings.map((w) => t.warnings.track(name, w)))
      parts.push({
        id: `P${parts.length + 1}`,
        name,
        instrumentName: track.instrumentName || 'piano',
        channel: track.channel,
        program: track.instrumentNumber,
        staves: [{ clef: track.clef ?? pickClef(notes), layout: layout.measures }],
        muted: muted.has(track.index),
      })
      partReports.push({
        name,
        noteCount: track.noteCount,
        maxVoices: Math.max(1, ...layout.measures.map((vs) => vs.length)),
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
