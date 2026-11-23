import { describe, expect, it } from 'vitest'
import { splitLines } from '../src/score/wrapTitle'

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
