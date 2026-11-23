import { describe, expect, it } from 'vitest'
import { decompose, layoutTrack, type VoiceMeasure } from '../src/midi/measures'
import { buildMeasureGrid, type MeasureSpec, type QNote } from '../src/midi/quantize'
import { G, PPQ, rng } from './helpers'

const SIGS = {
  '4/4': [{ ticks: 0, numerator: 4, denominator: 4 }],
  '3/4': [{ ticks: 0, numerator: 3, denominator: 4 }],
  '6/8': [{ ticks: 0, numerator: 6, denominator: 8 }],
  '7/8': [{ ticks: 0, numerator: 7, denominator: 8 }],
}

describe('음 길이 나누기 (decompose)', () => {
  it('한 덩어리로 표기되는 길이는 나누지 않는다', () => {
    expect(decompose(0, 16, 4)).toEqual([16]) // 온음표
    expect(decompose(0, 8, 4)).toEqual([8]) // 2분음표
    expect(decompose(8, 8, 4)).toEqual([8]) // 셋째 박의 2분음표
    expect(decompose(4, 4, 4)).toEqual([4])
    expect(decompose(0, 6, 4)).toEqual([6]) // 점4분음표
    expect(decompose(0, 12, 4)).toEqual([12]) // 점2분음표
  })

  it('박 구조를 어기는 위치의 긴 음은 나눈다 (둘째 박에서 시작하는 2분음표는 4분+4분)', () => {
    expect(decompose(4, 8, 4)).toEqual([4, 4])
  })

  it('나눈 조각의 합은 항상 원래 길이와 같다', () => {
    const r = rng(1)
    for (let i = 0; i < 2000; i++) {
      const beat = [2, 4, 6, 8][Math.floor(r() * 4)]
      const pos = Math.floor(r() * 16)
      const len = 1 + Math.floor(r() * 40)
      const parts = decompose(pos, len, beat)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(len)
      for (const p of parts) expect([1, 2, 3, 4, 6, 8, 12, 16, 24, 32]).toContain(p)
    }
  })
})

/** 악보 조각을 다시 (시작, 끝, 음높이) 목록으로 풀어 붙임줄을 합친다 */
function flatten(layout: VoiceMeasure[][], grid: MeasureSpec[]): [number, number, number][] {
  const out: [number, number, number][] = []
  const open = new Map<string, [number, number, number]>()
  layout.forEach((voices, mi) => {
    for (const vm of voices) {
      if (vm.wholeRest) continue
      let pos = grid[mi].startStep
      for (const p of vm.pieces) {
        for (const midi of p.midis) {
          const key = `${vm.voice}:${midi}`
          const prev = open.get(key)
          if (p.tieStop && prev) {
            prev[1] += p.duration
            if (!p.tieStart) open.delete(key)
          } else {
            const n: [number, number, number] = [pos, pos + p.duration, midi]
            out.push(n)
            if (p.tieStart) open.set(key, n)
          }
        }
        pos += p.duration
      }
    }
  })
  return out.sort((a, b) => a[0] - b[0] || a[2] - b[2])
}

describe('마디·성부 배치 (layoutTrack)', () => {
  for (const [name, sigs] of Object.entries(SIGS)) {
    it(`${name}: 마디선을 넘는 음·쉼표가 섞인 선율을 풀어 쓰면 원래 음과 정확히 같다`, () => {
      const r = rng(7)
      const notes: QNote[] = []
      let pos = 0
      while (pos < 200) {
        const len = 1 + Math.floor(r() * 20)
        if (r() > 0.2) notes.push({ start: pos, end: pos + len, midi: 55 + Math.floor(r() * 20), velocity: 0.7 })
        pos += len + (r() > 0.7 ? Math.floor(r() * 5) : 0)
      }
      const total = Math.max(...notes.map((n) => n.end))
      const grid = buildMeasureGrid(sigs, PPQ, total).measures
      const layout = layoutTrack(notes, grid)
      expect(flatten(layout.measures, grid)).toEqual(
        notes.map((n) => [n.start, n.end, n.midi]).sort((a, b) => a[0] - b[0]),
      )
    })

    it(`${name}: 모든 마디·성부의 길이 합이 마디 길이와 같다 (화음·겹침 포함)`, () => {
      const r = rng(11)
      const notes: QNote[] = []
      for (let i = 0; i < 120; i++) {
        const s = Math.floor(r() * 150)
        notes.push({ start: s, end: s + 1 + Math.floor(r() * 24), midi: 40 + Math.floor(r() * 40), velocity: 0.6 })
      }
      const total = Math.max(...notes.map((n) => n.end))
      const grid = buildMeasureGrid(sigs, PPQ, total).measures
      const { measures } = layoutTrack(notes, grid)
      expect(measures).toHaveLength(grid.length)
      measures.forEach((voices, mi) => {
        expect(voices.length).toBeGreaterThanOrEqual(1)
        expect(voices.length).toBeLessThanOrEqual(4)
        for (const vm of voices) {
          const sum = vm.wholeRest ? grid[mi].length : vm.pieces.reduce((a, p) => a + p.duration, 0)
          expect(sum).toBe(grid[mi].length)
        }
      })
    })
  }

  it('음표가 없으면 모든 마디가 온마디 쉼표', () => {
    const grid = buildMeasureGrid([], PPQ, 32).measures
    const { measures } = layoutTrack([], grid)
    expect(measures.every((v) => v.length === 1 && v[0].wholeRest)).toBe(true)
  })

  it('같은 시작·같은 끝의 음은 화음 하나로 묶는다', () => {
    const grid = buildMeasureGrid([], PPQ, 16).measures
    const notes: QNote[] = [60, 64, 67].map((midi) => ({ start: 0, end: 16, midi, velocity: 0.7 }))
    const { measures } = layoutTrack(notes, grid)
    expect(measures[0]).toHaveLength(1)
    expect(measures[0][0].pieces[0].midis).toEqual([60, 64, 67])
  })

  it('길이가 다른 동시 음은 성부를 나눈다 (선율은 1성부, 베이스는 2성부)', () => {
    const grid = buildMeasureGrid([], PPQ, 16).measures
    const notes: QNote[] = [
      { start: 0, end: 4, midi: 72, velocity: 0.7 },
      { start: 4, end: 8, midi: 74, velocity: 0.7 },
      { start: 0, end: 8, midi: 48, velocity: 0.7 },
    ]
    const { measures } = layoutTrack(notes, grid)
    const v1 = measures[0].find((v) => v.voice === 1)!
    const v2 = measures[0].find((v) => v.voice === 2)!
    expect(v1.pieces.filter((p) => p.midis.length).map((p) => p.midis[0])).toEqual([72, 74])
    expect(v2.pieces.filter((p) => p.midis.length).map((p) => p.midis[0])).toEqual([48])
  })

  it('1칸 이하로 겹친 이어 연주는 성부를 늘리지 않는다', () => {
    const grid = buildMeasureGrid([], PPQ, 16).measures
    const notes: QNote[] = [0, 4, 8, 12].map((s, i) => ({
      start: s,
      end: Math.min(16, s + 5),
      midi: 60 + i,
      velocity: 0.7,
    }))
    const { measures } = layoutTrack(notes, grid)
    expect(measures[0]).toHaveLength(1)
  })

  it('음이 마디 격자보다 길게 넘어가도 멈추지 않고 격자 끝에서 자른다', () => {
    const grid = buildMeasureGrid([], PPQ, 16).measures // 1마디(16칸)만 있음
    const notes: QNote[] = [
      { start: 12, end: 40, midi: 60, velocity: 0.7 },
      { start: 30, end: 34, midi: 62, velocity: 0.7 },
    ]
    const { measures } = layoutTrack(notes, grid)
    expect(measures).toHaveLength(1)
    const sum = measures[0][0].pieces.reduce((a, p) => a + p.duration, 0)
    expect(sum).toBe(16)
  })

  it('성부는 최대 4개까지만 만든다', () => {
    const grid = buildMeasureGrid([], PPQ, 16).measures
    const notes: QNote[] = [2, 4, 6, 8, 10, 12].map((len, i) => ({
      start: 0,
      end: len,
      midi: 60 + i * 3,
      velocity: 0.7,
    }))
    const { measures, warnings } = layoutTrack(notes, grid)
    expect(measures[0].length).toBeLessThanOrEqual(4)
    expect(warnings.length).toBeGreaterThan(0)
    void G
  })
})
