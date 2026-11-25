import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import type { QNote } from '../src/midi/quantize'
import { buildTimeline } from '../src/play/timeline'
import { buildInstrumentScore, defaultSettings } from '../src/score/buildScore'
import { splitHands } from '../src/score/hands'
import { measureOttava } from '../src/score/notation'
import { info, rng, track } from './helpers'

const q = (start: number, midi: number, len = 2): QNote => ({ start, end: start + len, midi, velocity: 0.7 })
const midis = (list: QNote[]) => list.map((n) => n.midi)

describe('양손 나누기 (splitHands)', () => {
  it('왼손 아르페지오가 가온 도를 지나가도 왼손에 남는다', () => {
    // 오른손 높은 화음을 잡은 채 왼손이 낮은 파에서 가온 도까지 올라갔다 내려온다
    const arpeggio = [41, 48, 53, 57, 60, 57, 53, 48].map((m, i) => q(i * 2, m))
    const r = splitHands([...arpeggio, q(0, 69, 16), q(0, 72, 16), q(0, 77, 16)])
    expect(midis(r.left)).toEqual([41, 48, 53, 57, 60, 57, 53, 48])
    expect(midis(r.right)).toEqual([77, 72, 69])
  })

  it('옥타브로 겹쳐 올라가는 양손 음계는 손이 바뀌지 않는다', () => {
    const scale = [60, 62, 64, 65, 67, 69, 71, 72]
    const r = splitHands(scale.flatMap((m, i) => [q(i * 2, m), q(i * 2, m - 12)]))
    expect(midis(r.right)).toEqual(scale)
    expect(midis(r.left)).toEqual(scale.map((m) => m - 12))
  })

  it('가온 도 아래로 잠깐 내려가는 오른손 선율은 오른손에 남는다', () => {
    const melody = [67, 64, 62, 59, 62, 64, 67].map((m, i) => q(i * 2, m))
    const r = splitHands([...melody, q(0, 36, 14), q(0, 43, 14)])
    expect(midis(r.right)).toEqual([67, 64, 62, 59, 62, 64, 67])
  })

  it('한 손이 닿지 않는 넓은 화음은 두 손으로 나눈다', () => {
    const r = splitHands([36, 43, 48, 60, 64, 67, 72].map((m) => q(0, m)))
    expect(Math.max(...midis(r.left)) - Math.min(...midis(r.left))).toBeLessThanOrEqual(16)
    expect(Math.max(...midis(r.right)) - Math.min(...midis(r.right))).toBeLessThanOrEqual(16)
  })

  it('아무 음이나 넣어도 하나도 빠지거나 늘지 않고, 같은 때의 왼손 음은 오른손 음보다 낮다', () => {
    const r = rng(5)
    const notes = Array.from({ length: 600 }, () => q(Math.floor(r() * 200), 24 + Math.floor(r() * 80)))
    const { left, right } = splitHands(notes)
    expect(left.length + right.length).toBe(600)
    expect([...midis(left), ...midis(right)].sort()).toEqual(midis(notes).sort())
    for (const l of left) for (const n of right) if (l.start === n.start) expect(l.midi).toBeLessThanOrEqual(n.midi)
  })
})

describe('마디별 옥타브 점선', () => {
  it('덧줄이 3개 이상 필요할 때만, 오른손은 위·왼손은 아래로 쓴다', () => {
    expect(measureOttava([72, 76, 81], 'G')).toBe(0)
    expect(measureOttava([96, 98, 100], 'G')).toBeGreaterThan(0)
    expect(measureOttava([53, 55], 'G')).toBe(0) // 낮은 음은 올려 적지 않는다
    expect(measureOttava([24, 28], 'F')).toBeLessThan(0)
    expect(measureOttava([24, 36], 'F')).toBe(-1) // 15mb보다 8vb
    expect(measureOttava([43, 48, 55], 'F')).toBe(0)
  })

  it('높고 낮은 마디에만 두 보표에 8va·8vb를 적고 음높이와 재생은 그대로다', () => {
    const tr = track(0, 'Piano', [
      [0, 16, 72],
      [0, 16, 48],
      [16, 16, 100],
      [16, 16, 24],
      [32, 16, 72],
      [32, 16, 48],
    ])
    const i = info([tr])
    const res = buildInstrumentScore(i, defaultSettings(i))
    const root = new DOMParser().parseFromString(res.xml, 'application/xml').documentElement!
    const measures = Array.from(root.getElementsByTagName('measure'))
    const shifts = measures.map((m) =>
      Array.from(m.getElementsByTagName('direction'))
        .filter((d) => d.getElementsByTagName('octave-shift').length)
        .map((d) => {
          const o = d.getElementsByTagName('octave-shift')[0]
          // 두 보표의 점선이 동시에 열려도 짝이 섞이지 않게 번호가 보표와 같아야 한다
          expect(o.getAttribute('number')).toBe(d.getElementsByTagName('staff')[0].textContent)
          return `${d.getElementsByTagName('staff')[0].textContent}${o.getAttribute('type')}`
        }),
    )
    expect(shifts).toEqual([[], ['1down', '1stop', '2up', '2stop'], []])
    expect(buildTimeline(res.model).notes.map((n) => n.midi)).toEqual([48, 72, 24, 100, 48, 72])
  })
})
