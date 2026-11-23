import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { buildInstrumentScore, buildPianoScore, defaultSettings } from '../src/score/buildScore'
import { escapeXml } from '../src/score/toMusicXml'
import { G, info, track } from './helpers'

type El = Element

const parse = (xml: string): El =>
  new DOMParser().parseFromString(xml, 'application/xml').documentElement as unknown as El
const kids = (el: El, tag: string): El[] =>
  (Array.from(el.childNodes) as unknown as El[]).filter((n) => n.nodeName === tag)
const all = (el: El, tag: string): El[] => Array.from(el.getElementsByTagName(tag) as unknown as ArrayLike<El>)
const text = (el: El, tag: string) => kids(el, tag)[0]?.textContent ?? ''

/** XML을 다시 읽어 성부별 길이 합을 계산한다 (악보 모델이 아니라 만들어진 파일 기준) */
function voiceSums(measure: El): Map<string, number> {
  const sums = new Map<string, number>()
  for (const n of kids(measure, 'note')) {
    if (kids(n, 'chord').length) continue
    const v = text(n, 'voice')
    sums.set(v, (sums.get(v) ?? 0) + Number(text(n, 'duration')))
  }
  return sums
}

const melody = track(0, 'Melody', [
  [0, 4, 72],
  [4, 4, 74],
  [8, 12, 76], // 마디선을 넘는 음 (4/4: 8~20 → 붙임줄)
  [24, 8, 72],
])
const bass = track(1, 'Bass', [
  [0, 16, 48],
  [16, 16, 43],
  [32, 16, 41],
])
const drums = track(2, 'Drums', [[0, 2, 36]], { kind: 'drum', channel: 10 })

describe('MusicXML 구조 — 악기별 악보', () => {
  const i = info([melody, bass, drums], {
    fileName: 'test.mid',
    keySignatures: [{ ticks: 0, fifths: -3, tonic: 'Eb', scale: 'major' }],
    tempos: [
      { ticks: 0, bpm: 100 },
      { ticks: 32 * G, bpm: 120 },
    ],
  })
  const res = buildInstrumentScore(i, defaultSettings(i))
  const root = parse(res.xml)

  it('score-partwise 3.1 이고 제목·파트 수가 맞다 (드럼 제외)', () => {
    expect(root.nodeName).toBe('score-partwise')
    expect(root.getAttribute('version')).toBe('3.1')
    expect(all(root, 'work-title')[0].textContent).toBe('test')
    expect(all(root, 'score-part').length).toBe(2)
    expect(all(root, 'part').length).toBe(2)
  })

  it('모든 마디·성부의 길이 합이 박자표와 정확히 일치한다', () => {
    for (const part of all(root, 'part')) {
      for (const m of kids(part, 'measure')) {
        for (const [voice, sum] of voiceSums(m))
          expect(sum, `${part.getAttribute('id')} ${m.getAttribute('number')}마디 ${voice}성부`).toBe(16)
      }
    }
  })

  it('조표·박자표·음자리표를 기록한다', () => {
    const attrs = all(root, 'attributes')[0]
    expect(all(attrs, 'fifths')[0].textContent).toBe('-3')
    expect(all(attrs, 'mode')[0].textContent).toBe('major')
    expect(all(attrs, 'beats')[0].textContent).toBe('4')
    expect(all(attrs, 'beat-type')[0].textContent).toBe('4')
    const clefs = all(root, 'sign').map((s) => s.textContent)
    expect(clefs).toEqual(['G', 'F']) // 선율 = 높은음자리표, 베이스 = 낮은음자리표
  })

  it('템포를 기록하고, 템포 변화는 해당 마디에 둔다', () => {
    const sounds = all(root, 'sound').map((s) => s.getAttribute('tempo'))
    expect(sounds).toEqual(['100', '120'])
    const part = all(root, 'part')[0]
    const m3 = kids(part, 'measure')[2]
    expect(all(m3, 'sound')[0].getAttribute('tempo')).toBe('120')
  })

  it('마디선을 넘는 음은 같은 높이의 붙임줄로 이어진다', () => {
    const part = all(root, 'part')[0]
    const [m1, m2] = kids(part, 'measure')
    const tiesOf = (m: El) =>
      kids(m, 'note')
        .filter((n) => kids(n, 'pitch').length && kids(n, 'tie').length)
        .map(
          (n) =>
            `${text(kids(n, 'pitch')[0], 'step')}${text(kids(n, 'pitch')[0], 'octave')}:${kids(n, 'tie')
              .map((t) => t.getAttribute('type'))
              .join('+')}`,
        )
    expect(tiesOf(m1)).toEqual(['E5:start'])
    expect(tiesOf(m2)).toEqual(['E5:stop'])
  })

  it('이상한 값(undefined, NaN, null)이 글자로 섞여 들어가지 않는다', () => {
    for (const bad of ['undefined', 'NaN', 'null', '[object']) expect(res.xml).not.toContain(bad)
  })

  it('제목에 XML 특수문자가 있어도 올바른 파일이 되고 다시 읽으면 같다', () => {
    const tricky = 'A & B <C> "D" \'E\''
    const src = info([melody], { fileName: `${tricky}.mid` })
    const r = buildInstrumentScore(src, defaultSettings(src))
    const doc = parse(r.xml)
    expect(all(doc, 'work-title')[0].textContent).toBe(tricky)
    expect(all(doc, 'credit-words')[0].textContent).toBe(tricky)
    expect(escapeXml('<&>')).toBe('&lt;&amp;&gt;')
  })

  it('제목을 맑은 고딕으로 지정한 credit을 넣는다 (Finale에서 한글이 깨지지 않게)', () => {
    const cw = all(root, 'credit-words')[0]
    expect(cw.getAttribute('font-family')).toBe('Malgun Gothic')
    expect(kids(all(root, 'credit')[0], 'credit-type')[0].textContent).toBe('title')
  })
})

describe('MusicXML 구조 — 피아노로 합친 악보', () => {
  const i = info([melody, bass, drums])
  const res = buildPianoScore(i, defaultSettings(i))
  const root = parse(res.xml)

  it('한 파트에 보표 2개 (높은음자리표 + 낮은음자리표)', () => {
    expect(all(root, 'score-part').length).toBe(1)
    expect(all(root, 'staves')[0].textContent).toBe('2')
    const clefs = all(root, 'clef').map((c) => `${c.getAttribute('number')}:${text(c, 'sign')}`)
    expect(clefs).toEqual(['1:G', '2:F'])
    expect(all(root, 'part-symbol')[0].textContent).toBe('brace')
  })

  it('악기는 Acoustic Grand Piano, MIDI 프로그램 번호는 1(=0번)이다', () => {
    expect(all(root, 'instrument-name')[0].textContent).toBe('Acoustic Grand Piano')
    expect(all(root, 'midi-program')[0].textContent).toBe('1')
  })

  it('모든 음·쉼표에 보표 번호가 있고 성부 번호가 보표마다 겹치지 않는다', () => {
    const voicesByStaff = new Map<string, Set<string>>()
    for (const n of all(root, 'note')) {
      const staff = text(n, 'staff')
      expect(['1', '2']).toContain(staff)
      if (!voicesByStaff.has(staff)) voicesByStaff.set(staff, new Set())
      voicesByStaff.get(staff)!.add(text(n, 'voice'))
    }
    const [a, b] = [voicesByStaff.get('1')!, voicesByStaff.get('2')!]
    expect([...a].filter((v) => b.has(v))).toEqual([])
  })

  it('모든 성부의 길이 합이 마디 길이와 같고, backup 길이도 마디 길이와 같다', () => {
    for (const m of kids(all(root, 'part')[0], 'measure')) {
      for (const [voice, sum] of voiceSums(m)) expect(sum, `${m.getAttribute('number')}마디 ${voice}성부`).toBe(16)
      for (const b of kids(m, 'backup')) expect(text(b, 'duration')).toBe('16')
    }
  })

  it('합친 결과 보고서가 원본 음표 수와 맞다 (드럼 제외 7음)', () => {
    expect(res.report.reduction).toMatchObject({ input: 7, duplicatesMerged: 0, removed: 0 })
    expect(res.report.excludedDrums).toEqual(['Drums'])
  })
})

describe('만들 수 없는 파일의 오류 안내', () => {
  it('드럼 트랙만 있으면 음높이 트랙이 없다고 알린다', () => {
    const i = info([drums])
    expect(() => buildInstrumentScore(i, defaultSettings(i))).toThrow('음 높이가 있는 트랙이 없습니다')
    expect(() => buildPianoScore(i, defaultSettings(i))).toThrow('음 높이가 있는 트랙이 없습니다')
  })
})
