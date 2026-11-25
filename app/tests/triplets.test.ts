import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { quantizeNotes } from '../src/midi/quantize'
import { findTripletBeats, tripletsAllowed } from '../src/midi/triplets'
import { buildTimeline } from '../src/play/timeline'
import { buildInstrumentScore, defaultSettings } from '../src/score/buildScore'
import { PPQ, info, rng, track } from './helpers'

/** [시작(박), 길이(박), 음높이] */
type N = [number, number, number]
const events = (list: N[]) =>
  list.map(([s, d, midi]) => ({
    ticks: Math.round(s * PPQ),
    durationTicks: Math.round(d * PPQ) - 6,
    midi,
    velocity: 0.7,
  }))
const song = (list: N[], opts: { program?: number; kind?: 'drum' } = {}) => {
  const tr = track(0, 'A', [[0, 1, 60]], { program: opts.program ?? 73, kind: opts.kind })
  tr.notes = events(list)
  tr.noteCount = list.length
  return info([tr])
}
const third = (beat: number, midi = 72): N[] => [0, 1, 2].map((i) => [beat + i / 3, 1 / 3, midi + i])

describe('3연음 박 찾기', () => {
  const beats = (list: N[]) => [...findTripletBeats(events(list), PPQ)]

  it('셋으로 나눈 박만 고르고, 8분·16분음표 박은 고르지 않는다', () => {
    expect(
      beats([...third(0), [1, 0.5, 60], [1.5, 0.5, 62], [2, 0.25, 60], [2.25, 0.25, 62], [2.75, 0.25, 64]]),
    ).toEqual([0])
  })

  it('셔플(4분 + 8분 셋잇단)도 3연음이고, 박마다 하나씩만 치면 아니다', () => {
    expect(
      beats([
        [0, 2 / 3, 60],
        [2 / 3, 1 / 3, 62],
      ]),
    ).toEqual([0])
    expect(
      beats([
        [0, 1, 60],
        [1, 1, 62],
      ]),
    ).toEqual([])
  })

  it('조금 흔들린 연주와 다음 박을 일찍 친 음을 받아 준다', () => {
    const r = rng(7)
    const played: N[] = []
    for (let b = 0; b < 40; b++)
      for (let i = 0; i < 3; i++) played.push([Math.max(0, b + i / 3 + (r() - 0.5) * 0.08), 0.3, 60])
    expect(beats(played)).toHaveLength(40)
    const sixteenths: N[] = []
    for (let b = 0; b < 40; b++)
      for (let i = 0; i < 4; i++) sixteenths.push([Math.max(0, b + i / 4 + (r() - 0.5) * 0.08), 0.2, 60])
    expect(beats(sixteenths)).toEqual([])
  })

  it('6/8 같은 박자에서는 찾지 않는다', () => {
    expect(tripletsAllowed([{ ticks: 0, numerator: 4, denominator: 4 }])).toBe(true)
    expect(tripletsAllowed([{ ticks: 0, numerator: 6, denominator: 8 }])).toBe(false)
  })

  it('3연음 박의 음은 셋으로 나눈 자리에 놓는다', () => {
    const q = quantizeNotes(events(third(1)), PPQ, new Set([4]))
    expect(q.offGrid).toBe(0)
    expect(q.notes.map((n) => [+n.start.toFixed(3), +n.end.toFixed(3)])).toEqual([
      [4, 5.333],
      [5.333, 6.667],
      [6.667, 8],
    ])
  })
})

describe('3연음 악보', () => {
  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml').documentElement!
  const all = (el: ReturnType<typeof parse>, name: string) => Array.from(el.getElementsByTagName(name))
  const text = (el: ReturnType<typeof parse>, name: string) => all(el, name)[0]?.textContent ?? ''
  /** 마디·성부마다 길이 합 (화음의 둘째 음부터는 뺀다) */
  const sums = (xml: string) =>
    all(parse(xml), 'measure').map((m) => {
      const by = new Map<string, number>()
      for (const n of all(m, 'note'))
        if (!all(n, 'chord').length) by.set(text(n, 'voice'), (by.get(text(n, 'voice')) ?? 0) + +text(n, 'duration'))
      return [...by.values()]
    })

  it('divisions 12, 셋잇단 표시와 괄호를 적고 마디 길이가 맞으며 재생 시각이 셋으로 나뉜다', () => {
    const i = song([...third(0), [1, 1, 76], ...third(2), [3, 2 / 3, 79], [3 + 2 / 3, 1 / 3, 81]])
    const res = buildInstrumentScore(i, defaultSettings(i))
    const root = parse(res.xml)
    expect(text(root, 'divisions')).toBe('12')
    expect(all(root, 'time-modification')).toHaveLength(8)
    expect(all(root, 'tuplet').map((e) => e.getAttribute('type'))).toEqual([
      'start',
      'stop',
      'start',
      'stop',
      'start',
      'stop',
    ])
    // 빔으로 묶이는 8분 셋은 숫자만, 4분+8분(셔플)은 괄호
    expect(
      all(root, 'tuplet')
        .filter((e) => e.getAttribute('type') === 'start')
        .map((e) => e.getAttribute('bracket')),
    ).toEqual(['no', 'no', 'yes'])
    expect(sums(res.xml)).toEqual([[48]])
    const starts = buildTimeline(res.model).notes.map((n) => +n.step.toFixed(3))
    expect(starts).toEqual([0, 1.333, 2.667, 4, 8, 9.333, 10.667, 12, 14.667])
    expect(res.report.warnings).toEqual([])
  })

  it('3연음이 없으면 예전처럼 divisions 4이고 셋잇단 표시가 없다', () => {
    const i = song([
      [0, 0.5, 60],
      [0.5, 0.5, 62],
    ])
    const xml = buildInstrumentScore(i, defaultSettings(i)).xml
    expect(xml).toContain('<divisions>4</divisions>')
    expect(xml).not.toContain('time-modification')
  })

  it('길게 울리는 음이 3연음 박에 걸치면 붙임줄로 잇고, 두 성부·타악기·정리 끔에서도 마디 길이가 맞다', () => {
    const cases = [
      song([
        [0, 4 / 3, 60],
        [4 / 3, 1 / 3, 62],
        [5 / 3, 1 / 3, 64],
        [2, 2, 65],
      ]),
      song([[0, 4, 48], ...third(1), ...third(3)], { program: 24 }),
      song([...third(0, 38), [1, 0.25, 38], ...third(2, 38)], { kind: 'drum' }),
      song([[0, 3, 48], ...third(1), [2.5, 2, 67]]),
    ]
    for (const [k, i] of cases.entries())
      for (const midiTidy of [true, false]) {
        const res = buildInstrumentScore(i, { ...defaultSettings(i), midiTidy })
        const length = res.xml.includes('<divisions>12</divisions>') ? 48 : 16
        for (const m of sums(res.xml)) for (const s of m) expect(s, `${k} ${midiTidy}`).toBe(length)
        expect(res.xml).toContain('<actual-notes>3</actual-notes>')
        expect(res.xml).not.toMatch(/undefined|NaN/)
      }
  })

  it('아무렇게나 섞은 리듬 300곡도 마디 길이가 맞는 악보가 된다', () => {
    const r = rng(11)
    for (let k = 0; k < 300; k++) {
      const list: N[] = []
      for (let n = 0; n < 30; n++) {
        const grid = r() < 0.5 ? 3 : 4
        const start = Math.floor(r() * 12) + Math.floor(r() * grid) / grid
        list.push([start, (1 + Math.floor(r() * 8)) / grid, 40 + Math.floor(r() * 40)])
      }
      const i = song(list, { program: [0, 24, 73][k % 3] })
      // 마디 길이·붙임줄 검사에 실패하면 여기서 오류가 난다
      const res = buildInstrumentScore(i, { ...defaultSettings(i), midiTidy: k % 2 === 0 })
      const length = res.xml.includes('<divisions>12</divisions>') ? 48 : 16
      for (const m of sums(res.xml)) for (const s of m) expect(s, `${k}`).toBe(length)
    }
  })
})
