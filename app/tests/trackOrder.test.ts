import { describe, expect, it } from 'vitest'
import { DOMParser } from '@xmldom/xmldom'
import { buildInstrumentScore, defaultSettings } from '../src/score/buildScore'
import { applySettings } from '../src/score/settings'
import { mergeFiles } from '../src/score/mergeFiles'
import { moveItem, orderBy, sameOrder } from '../src/score/trackOrder'
import { info, track } from './helpers'

const idx = (x: { index: number }) => x.index
const items = [0, 1, 2, 3].map((index) => ({ index }))

describe('악기 순서 계산 (orderBy)', () => {
  it('순서가 없거나 비어 있으면 원래 순서', () => {
    expect(orderBy(items, idx, undefined)).toBe(items)
    expect(orderBy(items, idx, [])).toBe(items)
  })
  it('정한 순서대로 정렬한다', () => {
    expect(orderBy(items, idx, [2, 0, 3, 1]).map(idx)).toEqual([2, 0, 3, 1])
  })
  it('목록에 없는 항목은 원래 순서대로 맨 뒤에 붙는다', () => {
    expect(orderBy(items, idx, [3, 1]).map(idx)).toEqual([3, 1, 0, 2])
  })
  it('없는 번호와 중복은 무시한다', () => {
    expect(orderBy(items, idx, [9, 2, 2, 0]).map(idx)).toEqual([2, 0, 1, 3])
  })
  it('항목을 잃거나 늘리지 않고 원본을 바꾸지 않는다', () => {
    const before = items.map(idx)
    const out = orderBy(items, idx, [3, 2, 1, 0])
    expect(out).toHaveLength(4)
    expect(items.map(idx)).toEqual(before)
  })
})

describe('항목 옮기기 (moveItem)', () => {
  it('앞뒤로 옮긴다', () => {
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3])
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
    expect(moveItem([1, 2, 3, 4], 1, 2)).toEqual([1, 3, 2, 4])
  })
  it('범위를 벗어나거나 같은 자리면 그대로', () => {
    const l = [1, 2, 3]
    expect(moveItem(l, 0, 0)).toBe(l)
    expect(moveItem(l, 0, 3)).toBe(l)
    expect(moveItem(l, -1, 1)).toBe(l)
  })
  it('sameOrder', () => {
    expect(sameOrder([1, 2], [1, 2])).toBe(true)
    expect(sameOrder([1, 2], [2, 1])).toBe(false)
  })
})

describe('악보에 순서가 반영된다', () => {
  const a = info([track(0, '멜로디', [[0, 4, 72]]), track(1, '베이스', [[0, 4, 40]])], { fileName: 'a.mid' })
  const b = info([track(0, '피아노', [[0, 4, 60]])], { fileName: 'b.mid' })
  const merged = mergeFiles([a, b]).info // 트랙 0: a 멜로디, 1: a 베이스, 2: b 피아노

  const partNames = (xml: string) =>
    Array.from(
      new DOMParser()
        .parseFromString(xml, 'application/xml')
        .getElementsByTagName('part-name') as unknown as ArrayLike<Element>,
    ).map((e) => e.textContent)

  it('기본은 파일 순서 → 파일 안 트랙 순서', () => {
    const res = buildInstrumentScore(merged, defaultSettings(merged))
    expect(partNames(res.xml)).toEqual(['a: 멜로디', 'a: 베이스', 'b: 피아노'])
  })

  it('정한 순서대로 단이 쌓이고, 파트 번호도 새 순서로 매겨진다', () => {
    const s = applySettings(merged, { trackOrder: [2, 0, 1] })
    const res = buildInstrumentScore(merged, s)
    expect(partNames(res.xml)).toEqual(['b: 피아노', 'a: 멜로디', 'a: 베이스'])
    expect(res.model.parts.map((p) => p.id)).toEqual(['P1', 'P2', 'P3'])
    expect(res.report.parts.map((p) => p.name)).toEqual(['b: 피아노', 'a: 멜로디', 'a: 베이스'])
  })

  it('순서를 바꿔도 음은 하나도 빠지지 않는다', () => {
    const base = buildInstrumentScore(merged, defaultSettings(merged))
    const swapped = buildInstrumentScore(merged, applySettings(merged, { trackOrder: [1, 2, 0] }))
    const count = (xml: string) => (xml.match(/<note>/g) ?? []).length
    expect(count(swapped.xml)).toBe(count(base.xml))
  })

  it('템포는 새 첫 파트가 아니라 악보 맨 위에 한 번만 표시된다', () => {
    const res = buildInstrumentScore(merged, applySettings(merged, { trackOrder: [2, 1, 0] }))
    expect((res.xml.match(/<sound tempo=/g) ?? []).length).toBe(1)
  })

  it('순서에 없는 트랙은 맨 뒤에 붙는다 (파일을 더 붙였을 때)', () => {
    const res = buildInstrumentScore(merged, applySettings(merged, { trackOrder: [2] }))
    expect(partNames(res.xml)).toEqual(['b: 피아노', 'a: 멜로디', 'a: 베이스'])
  })
})
