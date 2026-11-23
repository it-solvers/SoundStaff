import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { drawableText, parseOutlineFont, textToPathData, textWidth } from '../src/score/outlineText'

const buf = fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'fonts', 'SoundStaffKR-Regular.ttf'))
const font = parseOutlineFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const firstX = (d: string) => Number(/^M\s*(-?[\d.]+)/.exec(d)![1])

describe('PDF용 글자 윤곽선 (outlineText)', () => {
  it('한글 음절 11,172자가 모두 글꼴에 있다 (제목에 어떤 한글이 와도 빠지지 않는다)', () => {
    const missing: string[] = []
    for (let code = 0xac00; code <= 0xd7a3; code++)
      if (font.charToGlyphIndex(String.fromCharCode(code)) === 0) missing.push(String.fromCharCode(code))
    expect(missing).toEqual([])
  })

  it('영문·숫자·기호(파일 이름에 쓰이는 문자)도 모두 있다', () => {
    const chars = Array.from({ length: 0x7e - 0x21 + 1 }, (_, i) => String.fromCharCode(0x21 + i))
    expect(chars.filter((c) => font.charToGlyphIndex(c) === 0)).toEqual([])
  })

  it('한글·영문이 섞인 글자의 경로를 만든다', () => {
    const d = textToPathData(font, '01_멀티트랙_Eb장조', 100, 200, 40)
    expect(d.startsWith('M')).toBe(true)
    expect(d.length).toBeGreaterThan(500)
    expect(d).not.toMatch(/NaN|undefined/)
  })

  it('가운데·오른쪽 맞춤은 글자 폭만큼 시작 위치를 옮긴다', () => {
    const w = textWidth(font, '멜로디', 40)
    const start = firstX(textToPathData(font, '멜로디', 300, 100, 40, 'start'))
    const mid = firstX(textToPathData(font, '멜로디', 300, 100, 40, 'middle'))
    const end = firstX(textToPathData(font, '멜로디', 300, 100, 40, 'end'))
    // 첫 획의 x는 글자 시작점에서 조금 떨어져 있으므로 "차이"로 비교한다
    expect(start - mid).toBeCloseTo(w / 2, 0)
    expect(start - end).toBeCloseTo(w, 0)
  })

  it('글꼴에 없는 글자(기호, 이모지)는 빈 네모로 그려지지 않게 뺀다', () => {
    expect(drawableText(font, '멜😀로\u0007디')).toBe('멜로디')
    expect(drawableText(font, 'A B')).toBe('A B')
  })

  it('그릴 글자가 없으면 빈 경로를 돌려준다', () => {
    expect(textToPathData(font, '   ', 0, 0, 12)).toBe('')
    expect(textToPathData(font, '😀', 0, 0, 12)).toBe('')
  })

  it('여러 글자를 이어 그려도 NaN이 생기지 않는다 (세 글자 이상에서 NaN이 나던 문제의 회귀 시험)', () => {
    const d = textToPathData(font, '01_', 0, 0, 40)
    expect(d).not.toMatch(/NaN|undefined/)
    let seed = 1
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const pool = Array.from(
      '0123456789_-. ()&ABCDEFabcdef가나다라마바사아자차카타파하멜로디트랙박자장조곡제목작곡자홍길동',
    )
    for (let i = 0; i < 400; i++) {
      const len = 1 + Math.floor(rnd() * 30)
      const s = Array.from({ length: len }, () => pool[Math.floor(rnd() * pool.length)]).join('')
      expect(textToPathData(font, s, 12.5, 80, 24, 'middle'), s).not.toMatch(/NaN|undefined/)
    }
  })

  it('글자 크기에 비례한다 (두 배 크기의 폭은 두 배)', () => {
    expect(textWidth(font, '멜로디', 80)).toBeCloseTo(textWidth(font, '멜로디', 40) * 2, 1)
  })
})

describe('분리형 한글(NFD)도 PDF에 그려진다 (맥 파일 이름 문제의 회귀 시험)', () => {
  const title = '01_멀티트랙_드럼_3박자_Eb장조'
  it('분리형으로 바꾼 제목에서 글자가 지워지지 않고 합쳐진 형태로 남는다', () => {
    expect(drawableText(font, title.normalize('NFD'))).toBe(title)
  })

  it('분리형 제목의 윤곽선이 합쳐진 제목의 윤곽선과 똑같다', () => {
    expect(textToPathData(font, title.normalize('NFD'), 10, 50, 30)).toBe(textToPathData(font, title, 10, 50, 30))
  })

  it('분리형 한글이 글꼴에 없다는 사실 자체도 기록해 둔다 (그래서 합치는 처리가 필요)', () => {
    expect(font.charToGlyphIndex('ᄆ')).toBe(0)
  })
})
