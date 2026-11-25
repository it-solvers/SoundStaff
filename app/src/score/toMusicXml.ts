import { startsTie, stopsTie, type Piece } from '../midi/measures'
import { drumSound } from '../midi/percussion'
import { abbreviations } from './abbreviation'
import { MEASURES_PER_LINE } from './pdfSettings'
import type { PartModel, ScoreModel } from './types'

const SHARP_NAMES: [string, number][] = [
  ['C', 0],
  ['C', 1],
  ['D', 0],
  ['D', 1],
  ['E', 0],
  ['F', 0],
  ['F', 1],
  ['G', 0],
  ['G', 1],
  ['A', 0],
  ['A', 1],
  ['B', 0],
]
const FLAT_NAMES: [string, number][] = [
  ['C', 0],
  ['D', -1],
  ['D', 0],
  ['E', -1],
  ['E', 0],
  ['F', 0],
  ['G', -1],
  ['G', 0],
  ['A', -1],
  ['A', 0],
  ['B', -1],
  ['B', 0],
]

/** 길이(step) → MusicXML type, 점음표 여부 */
const TYPE_OF: Record<number, [string, boolean]> = {
  1: ['16th', false],
  2: ['eighth', false],
  3: ['eighth', true],
  4: ['quarter', false],
  6: ['quarter', true],
  8: ['half', false],
  12: ['half', true],
  16: ['whole', false],
  24: ['whole', true],
  32: ['breve', false],
}

/**
 * Finale(Windows)는 제목 글꼴을 따로 지정하지 않으면 한글이 없는 기본 글꼴로 제목을 만들어 한글이 깨진다.
 * 제목(credit)에 글꼴을 직접 지정한다. 맑은 고딕은 Windows에 기본 탑재된 한글 글꼴이다.
 */
const TITLE_FONT = 'Malgun Gothic'

/** A4 세로 용지 기준 페이지 설정 (단위: tenths, 7mm = 40tenths) */
const PAGE_DEFAULTS =
  '<defaults><scaling><millimeters>7</millimeters><tenths>40</tenths></scaling>' +
  '<page-layout><page-height>1697</page-height><page-width>1200</page-width>' +
  '<page-margins type="both"><left-margin>85</left-margin><right-margin>85</right-margin><top-margin>85</top-margin><bottom-margin>85</bottom-margin></page-margins>' +
  '</page-layout></defaults>'

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!)
}

/** 덜 주된 음(작고 짧은 음)의 색 */
export const MINOR_COLOR = '#8a8a8a'

function noteXml(
  p: Piece,
  voice: number,
  fifths: number,
  stem: string,
  hiddenRest: boolean,
  staff: number | null,
  /** 타악기 파트면 파트 id (음마다 어떤 타악기인지 가리킨다) */
  drumPart: string | null = null,
  /** 16분음표 한 칸의 divisions (3연음이 있으면 3, 없으면 1) */
  scale = 1,
): string {
  // 3연음 조각: 셋잇단 8분음표(4/3칸)·4분음표(8/3칸)
  const [type, dot] = p.triplet ? [p.duration > 2 ? 'quarter' : 'eighth', false] : TYPE_OF[p.duration]
  const duration = Math.round(p.duration * scale)
  const typeXml =
    `<type>${type}</type>${dot ? '<dot/>' : ''}` +
    (p.triplet
      ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>'
      : '')
  // 3연음 괄호의 시작·끝 (화음은 첫 음에만)
  const bracket = p.triplet
    ? (p.triplet.start ? `<tuplet type="start" bracket="${p.triplet.bracket ? 'yes' : 'no'}"/>` : '') +
      (p.triplet.stop ? '<tuplet type="stop"/>' : '')
    : ''
  const notations = (inner: string) => (inner ? `<notations>${inner}</notations>` : '')
  const staffXml = staff ? `<staff>${staff}</staff>` : ''
  if (p.midis.length === 0) {
    return `<note${hiddenRest ? ' print-object="no"' : ''}><rest/><duration>${duration}</duration><voice>${voice}</voice>${typeXml}${staffXml}${notations(bracket)}</note>`
  }
  if (drumPart) {
    return p.midis
      .map((midi, i) => {
        const d = drumSound(midi)!
        const head = d.head === 'normal' ? '' : `<notehead>${d.head}</notehead>`
        return (
          `<note>${i > 0 ? '<chord/>' : ''}<unpitched><display-step>${d.step}</display-step><display-octave>${d.octave}</display-octave></unpitched>` +
          `<duration>${duration}</duration><instrument id="${drumPart}-I${midi}"/><voice>${voice}</voice>${typeXml}${stem}${head}${staffXml}${notations(i === 0 ? bracket : '')}</note>`
        )
      })
      .join('')
  }
  const names = fifths < 0 ? FLAT_NAMES : SHARP_NAMES
  return p.midis
    .map((midi, i) => {
      const [step, alter] = names[midi % 12]
      const octave = Math.floor(midi / 12) - 1
      // 덜 주된 음은 회색으로 (MusicXML note의 color 속성. 악보 미리보기·PDF에서 보인다)
      // 붙임줄은 음마다 따로 적는다 (화음 중 계속 울리는 음만 이어질 수 있다)
      const stop = stopsTie(p, midi)
      const start = startsTie(p, midi)
      const ties = (stop ? '<tie type="stop"/>' : '') + (start ? '<tie type="start"/>' : '')
      const tied = notations(
        (stop ? '<tied type="stop"/>' : '') + (start ? '<tied type="start"/>' : '') + (i === 0 ? bracket : ''),
      )
      const color = p.minor?.includes(midi) ? ` color="${MINOR_COLOR}"` : ''
      return (
        `<note${color}>${i > 0 ? '<chord/>' : ''}<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>` +
        `<duration>${duration}</duration>${ties}<voice>${voice}</voice>${typeXml}${stem}${staffXml}${tied}</note>`
      )
    })
    .join('')
}

/** 보표가 여러 개인 파트에서 보표마다 성부 번호가 겹치지 않도록 하는 간격 (MAX_VOICES와 같은 값) */
const VOICES_PER_STAFF = 4

function partXml(part: PartModel, model: ScoreModel, isFirstPart: boolean, scale: number): string {
  const multi = part.staves.length > 1
  const measures = model.grid.map((spec, mi) => {
    const prev = model.grid[mi - 1]
    const timeChanged = !prev || prev.numerator !== spec.numerator || prev.denominator !== spec.denominator

    let attrs = ''
    if (mi === 0) {
      const clefs = part.staves
        .map(
          (st, si) =>
            `<clef${multi ? ` number="${si + 1}"` : ''}><sign>${st.clef}</sign><line>${st.clef === 'F' ? 4 : 2}</line>` +
            `${st.clefOctave ? `<clef-octave-change>${st.clefOctave}</clef-octave-change>` : ''}</clef>`,
        )
        .join('')
      attrs =
        `<attributes><divisions>${4 * scale}</divisions>` +
        // 타악기 보표에는 조표를 적지 않는다
        (part.percussion ? '' : `<key><fifths>${model.key.fifths}</fifths><mode>${model.key.mode}</mode></key>`) +
        `<time><beats>${spec.numerator}</beats><beat-type>${spec.denominator}</beat-type></time>` +
        `${multi ? `<staves>${part.staves.length}</staves><part-symbol>brace</part-symbol>` : ''}${clefs}` +
        // 타악기가 한두 가지뿐이어도 5줄 보표로 그린다 (한 줄 보표로 줄이면 음표가 줄에서 떨어져 보인다)
        `${part.percussion ? '<staff-details><staff-lines>5</staff-lines></staff-details>' : ''}</attributes>`
    } else if (timeChanged) {
      attrs = `<attributes><time><beats>${spec.numerator}</beats><beat-type>${spec.denominator}</beat-type></time></attributes>`
    }

    const bpm = isFirstPart ? model.tempoByMeasure.get(mi) : undefined
    const tempo = bpm
      ? `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit>` +
        `<per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`
      : ''

    // 보표 → 성부 순서로 이어 쓰고, 각 성부 사이는 <backup>으로 마디 처음으로 되돌린다
    const chunks: string[] = []
    part.staves.forEach((staff, si) => {
      const first = chunks.length
      const voices = staff.layout[mi]
      const stemmed = voices.length > 1 || !!part.percussion
      const staffNo = multi ? si + 1 : null
      for (const vm of voices) {
        const voiceNo = vm.voice + (multi ? si * VOICES_PER_STAFF : 0)
        // 발(2성부)만 치는 타악기 마디에서는 1성부의 빈 온쉼표를 감춘다
        const hidden = vm.voice > 1 || (!!part.percussion && vm.wholeRest && voices.length > 1)
        if (vm.wholeRest) {
          chunks.push(
            `<note${hidden ? ' print-object="no"' : ''}><rest measure="yes"/><duration>${spec.length * scale}</duration><voice>${voiceNo}</voice>${staffNo ? `<staff>${staffNo}</staff>` : ''}</note>`,
          )
        } else {
          const stem = stemmed ? `<stem>${vm.voice % 2 === 1 ? 'up' : 'down'}</stem>` : ''
          const drumPart = part.percussion ? part.id : null
          chunks.push(
            vm.pieces
              .map((p) => noteXml(p, voiceNo, model.key.fifths, stem, hidden, staffNo, drumPart, scale))
              .join(''),
          )
        }
      }
      // 옥타브 점선: 같은 표시가 이어지는 마디들의 처음과 끝에 적는다. MusicXML의 음높이는 소리 나는 높이 그대로다
      const here = staff.ottava?.[mi] ?? 0
      if (here && chunks.length > first) {
        const shift = (type: string) =>
          `<direction placement="${here > 0 ? 'above' : 'below'}"><direction-type><octave-shift type="${type}" size="${Math.abs(here) === 2 ? 15 : 8}"/></direction-type>${multi ? `<staff>${si + 1}</staff>` : ''}</direction>`
        if (staff.ottava![mi - 1] !== here) chunks[first] = shift(here > 0 ? 'down' : 'up') + chunks[first]
        if (staff.ottava![mi + 1] !== here) chunks[chunks.length - 1] += shift('stop')
      }
    })
    // 곡 끝에는 마침 세로줄(가는 줄 + 굵은 줄)
    const finalBar =
      mi === model.grid.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : ''
    // 한 줄에 4마디: 첫 파트에 줄바꿈 위치를 적는다 (줄바꿈은 악보 전체에 적용된다)
    const lineBreak = isFirstPart && mi > 0 && mi % MEASURES_PER_LINE === 0 ? '<print new-system="yes"/>' : ''
    return `<measure number="${mi + 1}">${lineBreak}${attrs}${tempo}${chunks.join(`<backup><duration>${spec.length * scale}</duration></backup>`)}${finalBar}</measure>`
  })
  return `<part id="${part.id}">\n${measures.join('\n')}\n</part>`
}

/** 타악기 파트의 목록 항목: 쓰인 타악기마다 악기 하나. Finale가 각 음을 알맞은 타악기 소리로 열게 한다 */
function drumScorePart(p: PartModel, abbr: string): string {
  const used = new Set(
    p.staves.flatMap((s) => s.layout.flatMap((vs) => vs.flatMap((v) => v.pieces))).flatMap((x) => x.midis),
  )
  const midis = [...used].sort((a, b) => a - b)
  return (
    `<score-part id="${p.id}"><part-name>${escapeXml(p.name)}</part-name><part-abbreviation>${escapeXml(abbr)}</part-abbreviation>` +
    midis
      .map(
        (m) =>
          `<score-instrument id="${p.id}-I${m}"><instrument-name>${drumSound(m)!.name}</instrument-name></score-instrument>`,
      )
      .join('') +
    // MusicXML의 midi-unpitched는 1부터 세므로 MIDI 번호 + 1
    midis
      .map(
        (m) =>
          `<midi-instrument id="${p.id}-I${m}"><midi-channel>${p.channel}</midi-channel><midi-unpitched>${m + 1}</midi-unpitched></midi-instrument>`,
      )
      .join('') +
    '</score-part>'
  )
}

/** 악보 모델 → MusicXML 3.1 (score-partwise) */
export function toMusicXml(model: ScoreModel): string {
  const abbr = abbreviations(model.parts)
  // 3연음이 있으면 4분음표를 12로 나눠야 길이가 정수가 된다
  const hasTriplet = model.parts.some((p) =>
    p.staves.some((s) => s.layout.some((vs) => vs.some((v) => v.pieces.some((x) => x.triplet)))),
  )
  const scale = hasTriplet ? 3 : 1
  const partList = model.parts
    .map((p, i) =>
      p.percussion
        ? drumScorePart(p, abbr[i])
        : `<score-part id="${p.id}"><part-name>${escapeXml(p.name)}</part-name><part-abbreviation>${escapeXml(abbr[i])}</part-abbreviation>` +
          `<score-instrument id="${p.id}-I1"><instrument-name>${escapeXml(p.instrumentName)}</instrument-name></score-instrument>` +
          `<midi-instrument id="${p.id}-I1"><midi-channel>${p.channel}</midi-channel><midi-program>${p.program + 1}</midi-program></midi-instrument></score-part>`,
    )
    .join('')
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n` +
    `<score-partwise version="3.1"><work><work-title>${escapeXml(model.title)}</work-title></work>` +
    '<identification>' +
    (model.composer ? `<creator type="composer">${escapeXml(model.composer)}</creator>` : '') +
    // 줄바꿈 표시를 담았음을 알린다 (Finale 같은 프로그램이 따르도록)
    '<encoding><supports element="print" attribute="new-system" type="yes" value="yes"/></encoding></identification>' +
    PAGE_DEFAULTS +
    `<credit page="1"><credit-type>title</credit-type>` +
    `<credit-words default-x="600" default-y="1612" justify="center" valign="top" font-family="${TITLE_FONT}" font-size="24">${escapeXml(model.title)}</credit-words></credit>` +
    (model.composer
      ? `<credit page="1"><credit-type>composer</credit-type>` +
        `<credit-words default-x="1115" default-y="1560" justify="right" valign="top" font-family="${TITLE_FONT}" font-size="12">${escapeXml(model.composer)}</credit-words></credit>`
      : '') +
    `<part-list>${partList}</part-list>\n` +
    model.parts.map((p, i) => partXml(p, model, i === 0, scale)).join('\n') +
    `\n</score-partwise>\n`
  )
}
