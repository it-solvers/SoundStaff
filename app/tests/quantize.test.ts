import { describe, expect, it } from 'vitest'
import {
  beatSteps,
  buildMeasureGrid,
  enforceMonophonic,
  gridTicks,
  measureLength,
  quantizeNotes,
} from '../src/midi/quantize'
import { G, PPQ } from './helpers'

const note = (startStep: number, durSteps: number, midi = 60) => ({
  ticks: startStep * G,
  durationTicks: durSteps * G,
  midi,
  velocity: 0.7,
})

describe('양자화 (quantizeNotes)', () => {
  it('틱을 16분음표 칸으로 바꾼다 (4분음표 = 4칸)', () => {
    expect(gridTicks(PPQ)).toBe(120)
    const r = quantizeNotes([note(0, 4), note(4, 8)], PPQ)
    expect(r.notes.map((n) => [n.start, n.end])).toEqual([
      [0, 4],
      [4, 12],
    ])
  })

  it('가장 가까운 칸으로 반올림한다', () => {
    const r = quantizeNotes([{ ticks: 130, durationTicks: 230, midi: 60, velocity: 1 }], PPQ)
    expect(r.notes[0]).toMatchObject({ start: 1, end: 3 }) // 130→1.08칸→1, 끝 360→3칸
  })

  it('아주 짧은 음도 최소 1칸을 가진다', () => {
    const r = quantizeNotes([{ ticks: 0, durationTicks: 5, midi: 60, velocity: 1 }], PPQ)
    expect(r.notes[0].end - r.notes[0].start).toBe(1)
  })

  it('같은 시작·같은 높이는 하나로 합치고 더 긴 쪽을 남긴다', () => {
    const r = quantizeNotes([note(0, 2, 60), note(0, 4, 60), note(0, 4, 64)], PPQ)
    expect(r.notes).toHaveLength(2)
    expect(r.notes.find((n) => n.midi === 60)!.end).toBe(4)
  })

  it('격자 이탈은 시작 위치만 센다 (끝을 살짝 떼는 연주는 정상)', () => {
    const staccato = quantizeNotes([note(0, 4), { ticks: 4 * G, durationTicks: 3.6 * G, midi: 62, velocity: 1 }], PPQ)
    expect(staccato.offGrid).toBe(0)
    const triplets = quantizeNotes(
      [0, 1, 2, 3].map((i) => ({ ticks: i * 160, durationTicks: 150, midi: 60, velocity: 1 })),
      PPQ,
    )
    expect(triplets.offGrid).toBeGreaterThan(0)
  })

  it('시작 순서로 정렬해서 돌려준다', () => {
    const r = quantizeNotes([note(8, 1), note(0, 1), note(4, 1)], PPQ)
    expect(r.notes.map((n) => n.start)).toEqual([0, 4, 8])
  })
})

describe('마디 길이·박 (measureLength, beatSteps)', () => {
  it.each([
    [4, 4, 16],
    [3, 4, 12],
    [6, 8, 12],
    [7, 8, 14],
    [2, 2, 16],
    [5, 16, 5],
  ])('%i/%i 박자는 %i칸', (n, d, expected) => {
    expect(measureLength(n, d)).toBe(expected)
  })

  it('분모가 1·2·4·8·16이 아니면 지원하지 않는다', () => {
    expect(measureLength(3, 32)).toBeNull()
    expect(measureLength(4, 3)).toBeNull()
    expect(measureLength(0, 4)).toBeNull()
  })

  it('겹박자(6/8, 9/8, 12/8)는 점4분음표가 한 박', () => {
    expect(beatSteps(6, 8)).toBe(6)
    expect(beatSteps(9, 8)).toBe(6)
    expect(beatSteps(3, 8)).toBe(2)
    expect(beatSteps(4, 4)).toBe(4)
    expect(beatSteps(3, 4)).toBe(4)
  })
})

describe('마디 경계 (buildMeasureGrid)', () => {
  it('박자표가 없으면 4/4로 만든다', () => {
    const g = buildMeasureGrid([], PPQ, 40)
    expect(g.measures.map((m) => m.length)).toEqual([16, 16, 16])
    expect(g.measures[2].startStep).toBe(32)
  })

  it('마지막 음까지 덮도록 마디를 만든다 (끝이 마디 경계면 더 만들지 않는다)', () => {
    expect(buildMeasureGrid([], PPQ, 16).measures).toHaveLength(1)
    expect(buildMeasureGrid([], PPQ, 17).measures).toHaveLength(2)
    expect(buildMeasureGrid([], PPQ, 0).measures).toHaveLength(1)
  })

  it('중간에 바뀌는 박자표는 다음 마디부터 적용한다', () => {
    const sigs = [
      { ticks: 0, numerator: 4, denominator: 4 },
      { ticks: 32 * G, numerator: 3, denominator: 4 },
    ]
    const g = buildMeasureGrid(sigs, PPQ, 56)
    expect(g.measures.map((m) => `${m.numerator}/${m.denominator}`)).toEqual(['4/4', '4/4', '3/4', '3/4'])
    expect(g.measures[2].startStep).toBe(32)
  })

  it('지원하지 않는 박자표는 4/4로 처리하고 경고한다', () => {
    const g = buildMeasureGrid([{ ticks: 0, numerator: 3, denominator: 32 }], PPQ, 16)
    expect(g.measures[0]).toMatchObject({ numerator: 4, denominator: 4, length: 16 })
    expect(g.warnings.length).toBe(1)
  })
})

describe('한 줄 선율 보장 (enforceMonophonic)', () => {
  const q = (start: number, end: number, midi: number, velocity = 0.7) => ({ start, end, midi, velocity })
  it('같은 칸에서 시작한 음은 더 긴 음 하나만 남긴다', () => {
    expect(enforceMonophonic([q(0, 1, 72), q(0, 4, 60)])).toEqual([q(0, 4, 60)])
  })
  it('길이가 같으면 더 높은 음을 남긴다', () => {
    expect(enforceMonophonic([q(0, 2, 60), q(0, 2, 67)])).toEqual([q(0, 2, 67)])
  })
  it('앞 음이 다음 음 시작 뒤까지 이어지면 다음 음 시작에서 끊는다', () => {
    expect(enforceMonophonic([q(0, 6, 60), q(4, 8, 62)])).toEqual([q(0, 4, 60), q(4, 8, 62)])
  })
  it('이미 한 줄이면 그대로', () => {
    const line = [q(0, 2, 60), q(2, 4, 62), q(6, 8, 64)]
    expect(enforceMonophonic(line)).toEqual(line)
  })
  it('빈 입력은 빈 결과', () => expect(enforceMonophonic([])).toEqual([]))
  it('무작위로 겹친 음도 항상 시작 순서이고 겹침이 없으며 길이가 1칸 이상이다', () => {
    let seed = 5
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let t = 0; t < 100; t++) {
      const notes = Array.from({ length: 60 }, () => {
        const s = Math.floor(rnd() * 80)
        return q(s, s + 1 + Math.floor(rnd() * 10), 48 + Math.floor(rnd() * 36))
      })
      const out = enforceMonophonic(notes)
      expect(out.length).toBeGreaterThan(0)
      out.forEach((n, i) => {
        expect(n.end - n.start).toBeGreaterThanOrEqual(1)
        if (i > 0) expect(n.start).toBeGreaterThanOrEqual(out[i - 1].end)
      })
    }
  })
})
