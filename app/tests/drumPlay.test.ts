import { describe, expect, it } from 'vitest'
import { buildTimeline } from '../src/play/timeline'
import { buildInstrumentScore, defaultSettings } from '../src/score/buildScore'
import { findRolls, limitHands } from '../src/score/drumPlay'
import { PPQ, info, track } from './helpers'

const hit = (ticks: number, midi: number) => ({ ticks, durationTicks: 10, midi, velocity: 0.7 })
/** 32분음표보다 촘촘한 연타: from박부터 beats박 동안 */
const fast = (from: number, beats: number, midi: number) =>
  Array.from({ length: beats * 12 }, (_, i) => hit(from * PPQ + (i * PPQ) / 12, midi))
const kit = (notes: ReturnType<typeof hit>[]) => {
  const tr = track(0, 'Kit', [[0, 1, 36]], { kind: 'drum', channel: 10 })
  tr.notes = notes
  tr.noteCount = notes.length
  return info([tr])
}

describe('롤 찾기', () => {
  it('아주 빠른 연타 8번 이상만 롤이고, 16분·32분 몇 번은 보통 타격이다', () => {
    const r = findRolls([...fast(0, 2, 49), hit(4 * PPQ, 38), hit(4.25 * PPQ, 38), hit(4.5 * PPQ, 38)], PPQ)
    expect(r.rolls).toEqual([{ midi: 49, start: 0, end: 8 }])
    expect(r.rest).toHaveLength(3)
    expect(findRolls(fast(0, 1, 38).slice(0, 7), PPQ).rolls).toEqual([])
    const sixteenths = Array.from({ length: 16 }, (_, i) => hit((i * PPQ) / 4, 42))
    expect(findRolls(sixteenths, PPQ).rolls).toEqual([])
  })

  it('롤의 마지막 타격이 다음 박 머리에 닿으면 그 박에도 롤을 적는다', () => {
    const i = kit([...fast(0, 1, 49), hit(PPQ, 49)])
    expect(findRolls(i.tracks[0].notes, PPQ).rolls).toEqual([{ midi: 49, start: 0, end: 5 }])
    const res = buildInstrumentScore(i, defaultSettings(i))
    expect(buildTimeline(res.model).notes.some((n) => n.step === 4)).toBe(true)
  })

  it('악보에는 롤 표시가 붙은 몇 개의 음표로 적고, 재생은 연타로 들린다', () => {
    const i = kit([...fast(0, 2, 49), hit(PPQ / 2, 36)])
    const res = buildInstrumentScore(i, defaultSettings(i))
    expect(res.xml.match(/<tremolo type="single">3<\/tremolo>/g)!.length).toBeGreaterThanOrEqual(2)
    expect(res.report.parts[0].noteCount).toBeLessThan(6)
    expect(buildTimeline(res.model).notes.filter((n) => n.midi === 49)).toHaveLength(16)
    expect(res.report.warnings.some((w) => w.includes('롤'))).toBe(true)
    expect(res.report.warnings.some((w) => w.includes('격자'))).toBe(false)
    expect(buildInstrumentScore(i, { ...defaultSettings(i), midiTidy: false }).xml).not.toContain('tremolo')
    const muted = buildInstrumentScore(i, { ...defaultSettings(i), mutedTracks: [0] })
    expect(buildTimeline(muted.model).notes).toEqual([])
  })
})

describe('손은 두 개', () => {
  const q = (start: number, midi: number) => ({ start, end: start + 1, midi, velocity: 0.7 })

  it('셋 이상이면 하이햇, 라이드 순으로 빼고 발은 세지 않는다', () => {
    const foot = (m: number) => m === 36
    const r = limitHands(
      [q(0, 42), q(0, 38), q(0, 49), q(0, 36), q(4, 42), q(4, 38), q(8, 51), q(8, 48), q(8, 41)],
      foot,
    )
    expect(r.dropped).toBe(2)
    expect(r.notes.map((n) => `${n.start}:${n.midi}`)).toEqual(['0:38', '0:49', '0:36', '4:42', '4:38', '8:48', '8:41'])
  })

  it('드럼 세트 보표에만 적용하고 알려 준다. 정리를 끄면 모두 남는다', () => {
    const i = kit([hit(0, 42), hit(0, 38), hit(0, 49)])
    const res = buildInstrumentScore(i, defaultSettings(i))
    expect(buildTimeline(res.model).notes.map((n) => n.midi)).toEqual([38, 49])
    expect(res.report.warnings.some((w) => w.includes('동시에 칠 수 없는 타격 1개'))).toBe(true)
    const raw = buildInstrumentScore(i, { ...defaultSettings(i), midiTidy: false })
    expect(buildTimeline(raw.model).notes).toHaveLength(3)
  })
})
