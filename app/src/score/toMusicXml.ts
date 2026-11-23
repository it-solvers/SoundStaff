import type { Piece } from '../midi/measures'
import type { PartModel, ScoreModel } from './types'

const SHARP_NAMES: [string, number][] = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
]
const FLAT_NAMES: [string, number][] = [
  ['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0],
  ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0],
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

function noteXml(p: Piece, voice: number, fifths: number, stem: string, hiddenRest: boolean, staff: number | null): string {
  const [type, dot] = TYPE_OF[p.duration]
  const typeXml = `<type>${type}</type>${dot ? '<dot/>' : ''}`
  const staffXml = staff ? `<staff>${staff}</staff>` : ''
  if (p.midis.length === 0) {
    return `<note${hiddenRest ? ' print-object="no"' : ''}><rest/><duration>${p.duration}</duration><voice>${voice}</voice>${typeXml}${staffXml}</note>`
  }
  const names = fifths < 0 ? FLAT_NAMES : SHARP_NAMES
  const ties = (p.tieStop ? '<tie type="stop"/>' : '') + (p.tieStart ? '<tie type="start"/>' : '')
  const tied =
    p.tieStart || p.tieStop
      ? `<notations>${p.tieStop ? '<tied type="stop"/>' : ''}${p.tieStart ? '<tied type="start"/>' : ''}</notations>`
      : ''
  return p.midis
    .map((midi, i) => {
      const [step, alter] = names[midi % 12]
      const octave = Math.floor(midi / 12) - 1
      return (
        `<note>${i > 0 ? '<chord/>' : ''}<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>` +
        `<duration>${p.duration}</duration>${ties}<voice>${voice}</voice>${typeXml}${stem}${staffXml}${tied}</note>`
      )
    })
    .join('')
}

/** 보표가 여러 개인 파트에서 보표마다 성부 번호가 겹치지 않도록 하는 간격 (MAX_VOICES와 같은 값) */
const VOICES_PER_STAFF = 4

function partXml(part: PartModel, model: ScoreModel, isFirstPart: boolean): string {
  const multi = part.staves.length > 1
  const measures = model.grid.map((spec, mi) => {
    const prev = model.grid[mi - 1]
    const timeChanged = !prev || prev.numerator !== spec.numerator || prev.denominator !== spec.denominator

    let attrs = ''
    if (mi === 0) {
      const clefs = part.staves
        .map((st, si) => `<clef${multi ? ` number="${si + 1}"` : ''}><sign>${st.clef}</sign><line>${st.clef === 'G' ? 2 : 4}</line></clef>`)
        .join('')
      attrs =
        `<attributes><divisions>4</divisions>` +
        `<key><fifths>${model.key.fifths}</fifths><mode>${model.key.mode}</mode></key>` +
        `<time><beats>${spec.numerator}</beats><beat-type>${spec.denominator}</beat-type></time>` +
        `${multi ? `<staves>${part.staves.length}</staves><part-symbol>brace</part-symbol>` : ''}${clefs}</attributes>`
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
      const voices = staff.layout[mi]
      const stemmed = voices.length > 1
      const staffNo = multi ? si + 1 : null
      for (const vm of voices) {
        const voiceNo = vm.voice + (multi ? si * VOICES_PER_STAFF : 0)
        const hidden = vm.voice > 1
        if (vm.wholeRest) {
          chunks.push(
            `<note${hidden ? ' print-object="no"' : ''}><rest measure="yes"/><duration>${spec.length}</duration><voice>${voiceNo}</voice>${staffNo ? `<staff>${staffNo}</staff>` : ''}</note>`,
          )
        } else {
          const stem = stemmed ? `<stem>${vm.voice % 2 === 1 ? 'up' : 'down'}</stem>` : ''
          chunks.push(vm.pieces.map((p) => noteXml(p, voiceNo, model.key.fifths, stem, hidden, staffNo)).join(''))
        }
      }
    })
    return `<measure number="${mi + 1}">${attrs}${tempo}${chunks.join(`<backup><duration>${spec.length}</duration></backup>`)}</measure>`
  })
  return `<part id="${part.id}">\n${measures.join('\n')}\n</part>`
}

/** 악보 모델 → MusicXML 3.1 (score-partwise) */
export function toMusicXml(model: ScoreModel): string {
  const partList = model.parts
    .map(
      (p) =>
        `<score-part id="${p.id}"><part-name>${escapeXml(p.name)}</part-name>` +
        `<score-instrument id="${p.id}-I1"><instrument-name>${escapeXml(p.instrumentName)}</instrument-name></score-instrument>` +
        `<midi-instrument id="${p.id}-I1"><midi-channel>${p.channel}</midi-channel><midi-program>${p.program + 1}</midi-program></midi-instrument></score-part>`,
    )
    .join('')
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n` +
    `<score-partwise version="3.1"><work><work-title>${escapeXml(model.title)}</work-title></work>` +
    PAGE_DEFAULTS +
    `<credit page="1"><credit-type>title</credit-type>` +
    `<credit-words default-x="600" default-y="1612" justify="center" valign="top" font-family="${TITLE_FONT}" font-size="24">${escapeXml(model.title)}</credit-words></credit>` +
    `<part-list>${partList}</part-list>\n` +
    model.parts.map((p, i) => partXml(p, model, i === 0)).join('\n') +
    `\n</score-partwise>\n`
  )
}
