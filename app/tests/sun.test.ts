import { describe, expect, it } from 'vitest'
import { isDaytime, nearestSunTimes, sunTimesAround } from '../src/theme/sun'
import { resolveTheme } from '../src/theme/theme'

/** 한국 표준시(KST)로 시각을 만든다 */
const kst = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(Date.UTC(y, mo - 1, d, h - 9, mi))
const minutesKst = (dt: Date) => {
  const k = new Date(dt.getTime() + 9 * 3600_000)
  return k.getUTCHours() * 60 + k.getUTCMinutes()
}
const near = (actual: number, h: number, m: number, tol = 8) => Math.abs(actual - (h * 60 + m)) <= tol

describe('일출·일몰 계산 (인천 기준)', () => {
  it('2026-11-24: 일출 07시 20분쯤, 일몰 17시 15분쯤 (±8분)', () => {
    const s = nearestSunTimes(kst(2026, 11, 24, 12))!
    expect(near(minutesKst(s.sunrise), 7, 20), `일출 ${minutesKst(s.sunrise)}`).toBe(true)
    expect(near(minutesKst(s.sunset), 17, 15), `일몰 ${minutesKst(s.sunset)}`).toBe(true)
  })

  it('하지(6월 21일)는 낮이 약 14시간 50분, 동지(12월 22일)는 약 9시간 30분 (±10분)', () => {
    const len = (dt: Date) => {
      const s = nearestSunTimes(dt)!
      return (s.sunset.getTime() - s.sunrise.getTime()) / 60000
    }
    expect(Math.abs(len(kst(2026, 6, 21, 12)) - (14 * 60 + 50))).toBeLessThanOrEqual(10)
    expect(Math.abs(len(kst(2026, 12, 22, 12)) - (9 * 60 + 30))).toBeLessThanOrEqual(10)
  })

  it('낮에는 true, 한밤중에는 false (계절 상관없이)', () => {
    for (const [mo, d] of [
      [1, 15],
      [4, 10],
      [7, 20],
      [10, 5],
      [12, 22],
    ]) {
      expect(isDaytime(kst(2026, mo, d, 12)), `${mo}/${d} 정오`).toBe(true)
      expect(isDaytime(kst(2026, mo, d, 0, 30)), `${mo}/${d} 0시 30분`).toBe(false)
      expect(isDaytime(kst(2026, mo, d, 23, 30)), `${mo}/${d} 23시 30분`).toBe(false)
    }
  })

  it('일출·일몰 바로 앞뒤에서 바뀐다', () => {
    const s = nearestSunTimes(kst(2026, 11, 24, 12))!
    const t = (d: Date, sec: number) => new Date(d.getTime() + sec * 1000)
    expect(isDaytime(t(s.sunrise, -60))).toBe(false)
    expect(isDaytime(t(s.sunrise, 60))).toBe(true)
    expect(isDaytime(t(s.sunset, -60))).toBe(true)
    expect(isDaytime(t(s.sunset, 60))).toBe(false)
  })

  it('하루 종일 밤낮이 한 번씩만 바뀐다 (1분 간격, 4개 계절)', () => {
    for (const [mo, d] of [
      [3, 20],
      [6, 21],
      [9, 23],
      [12, 22],
    ]) {
      let flips = 0
      let prev = isDaytime(kst(2026, mo, d, 0, 0))
      for (let m = 1; m < 24 * 60; m++) {
        const cur = isDaytime(kst(2026, mo, d, 0, m))
        if (cur !== prev) flips++
        prev = cur
      }
      expect(flips, `${mo}/${d}`).toBe(2)
    }
  })

  it('전날·당일·다음날 세 날을 돌려준다', () => expect(sunTimesAround(kst(2026, 5, 5, 12))).toHaveLength(3))
})

describe('테마 결정 (resolveTheme)', () => {
  it('밝게·어둡게를 고르면 시각과 상관없이 그대로', () => {
    expect(resolveTheme('light', kst(2026, 11, 24, 2))).toBe('light')
    expect(resolveTheme('dark', kst(2026, 11, 24, 12))).toBe('dark')
  })
  it('자동은 낮이면 밝게, 밤이면 어둡게', () => {
    expect(resolveTheme('auto', kst(2026, 11, 24, 12))).toBe('light')
    expect(resolveTheme('auto', kst(2026, 11, 24, 21))).toBe('dark')
  })
})
