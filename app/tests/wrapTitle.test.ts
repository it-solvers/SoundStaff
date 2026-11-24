import { describe, expect, it } from 'vitest'
import { layoutTitle, splitLines, TITLE_SCALES } from '../src/score/wrapTitle'

/** 글자 하나를 폭 1로 치는 가짜 측정기 */
const fitsWithin = (max: number) => (s: string) => s.length <= max

describe('긴 곡 제목 줄 나누기 (splitLines)', () => {
  it('폭 안에 들어오면 한 줄', () => expect(splitLines('짧은 제목', fitsWithin(20))).toEqual(['짧은 제목']))

  it('띄어쓰기에서 먼저 나눈다', () => {
    expect(splitLines('우리 기도를 Hear Our Prayer', fitsWithin(12))).toEqual(['우리 기도를 Hear', 'Our Prayer'])
  })

  it('모든 줄이 폭 안에 들어오고, 이어 붙이면 원래 글자가 그대로다', () => {
    const text = '우리 기도를 (Arr. Sangeun Han) Hear Our Prayer O Lord 아주 긴 제목'
    const lines = splitLines(text, fitsWithin(14))
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(14)
    expect(lines.join(' ').replace(/\s+/g, '')).toBe(text.replace(/\s+/g, ''))
  })

  it('띄어쓰기 없이 폭보다 긴 단어는 글자 단위로 나눈다', () => {
    expect(splitLines('가나다라마바사아', fitsWithin(3))).toEqual(['가나다', '라마바', '사아'])
  })

  it('빈 제목은 줄이 없다', () => expect(splitLines('   ', fitsWithin(5))).toEqual([]))
})

describe('제목 배치: 길면 글자를 줄여 2줄 안에 맞춘다 (layoutTitle)', () => {
  /** 글자 하나의 폭 = 글자 크기 × 0.6 인 가짜 측정기 */
  const widthAt = (s: string, px: number) => s.length * px * 0.6

  it('원래 크기로 한 줄에 들어가면 그대로 둔다', () => {
    expect(layoutTitle('짧은 제목', 40, 600, widthAt)).toEqual({ lines: ['짧은 제목'], fontPx: 40, shrunk: false })
  })

  it('두 줄로 나누면 맞는 제목은 글자를 줄이지 않는다', () => {
    const r = layoutTitle('우리 기도를 Hear Our Prayer O Lord', 40, 600, widthAt) // 한 줄 폭 약 816
    expect(r.lines.length).toBeLessThanOrEqual(2)
    expect(r.fontPx).toBe(40)
    expect(r.shrunk).toBe(false)
  })

  it('3줄이 필요한 긴 제목은 글자를 줄여서 2줄에 맞춘다', () => {
    const text = '우리 기도를 (Arr. Sangeun Han) Hear Our Prayer O Lord - MIDI 음원분석'
    const r = layoutTitle(text, 40, 600, widthAt)
    expect(r.lines.length).toBeLessThanOrEqual(2)
    expect(r.fontPx).toBeLessThan(40)
    expect(r.shrunk).toBe(true)
    for (const l of r.lines) expect(widthAt(l, r.fontPx)).toBeLessThanOrEqual(600)
    expect(r.lines.join(' ')).toBe(text) // 글자가 빠지지 않는다
  })

  it('가장 큰 크기 중 2줄에 맞는 것을 고른다 (불필요하게 작게 줄이지 않는다)', () => {
    const text = '가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 가나다라마바사아자차카타파하'
    const r = layoutTitle(text, 40, 600, widthAt)
    const next = TITLE_SCALES[TITLE_SCALES.indexOf(r.fontPx / 40) - 1]
    if (next) expect(splitLines(text, (s) => widthAt(s, 40 * next) <= 600).length).toBeGreaterThan(2)
  })

  it('너무 길어 가장 작은 크기로도 안 되면 최대 줄 수에서 …로 줄인다', () => {
    const r = layoutTitle('가'.repeat(400), 40, 300, widthAt, 3)
    expect(r.lines).toHaveLength(3)
    expect(r.lines[2].endsWith('…')).toBe(true)
    for (const l of r.lines) expect(widthAt(l, r.fontPx)).toBeLessThanOrEqual(300)
  })

  it('빈 제목은 줄이 없다', () => expect(layoutTitle('  ', 40, 300, widthAt).lines).toEqual([]))
})
