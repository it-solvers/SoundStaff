import { describe, expect, it } from 'vitest'
import { ADDED_VELOCITY, audiblePitches, computeSalience, midiToHz, refineNotes } from '../src/audio/spectrum'
import type { AudioNote } from '../src/midi/types'

const SR = 22050
/** 정해진 높이들을 sec초 동안 울리는 소리 (배음을 약하게 섞어 실제 악기에 가깝게) */
function tone(midis: number[], sec: number, harmonics = [1, 0.4, 0.2]): Float32Array {
  const out = new Float32Array(Math.floor(sec * SR))
  for (const m of midis) {
    const f = midiToHz(m)
    harmonics.forEach((a, h) => {
      for (let i = 0; i < out.length; i++) out[i] += a * 0.2 * Math.sin(2 * Math.PI * f * (h + 1) * (i / SR))
    })
  }
  return out
}
const note = (midi: number, startSec: number, durationSec: number, velocity = 0.8): AudioNote => ({
  midi,
  startSec,
  durationSec,
  velocity,
})

describe('주파수 분석 보정 (refineNotes)', () => {
  it('울리는 음 높이를 프레임에서 정확히 찾는다 (낮은 음의 배음은 음으로 치지 않는다)', () => {
    const s = computeSalience(tone([60, 67], 2), SR)
    const f = Math.floor(s.times.length / 2)
    const found = [...audiblePitches(s, f)]
    expect(found).toContain(60)
    expect(found).toContain(67)
    expect(found).not.toContain(72) // C4의 2배음(옥타브)
  })

  it('AI가 놓친 음은 낮은 세기로 채운다', () => {
    const pcm = tone([60, 64, 67], 3)
    const r = refineNotes(pcm, SR, [note(60, 0, 3), note(64, 0, 3)]) // 67을 놓침
    expect(r.added).toBeGreaterThanOrEqual(1)
    const g = r.notes.find((n) => n.midi === 67)
    expect(g).toBeTruthy()
    expect(g!.velocity).toBe(ADDED_VELOCITY)
    expect(g!.startSec).toBeLessThan(0.3)
    expect(g!.startSec + g!.durationSec).toBeGreaterThan(2.5)
    expect(r.removed).toBe(0)
  })

  it('소리가 없는 높이에 AI가 넣은 음은 뺀다', () => {
    const pcm = tone([60, 67], 3)
    const r = refineNotes(pcm, SR, [note(60, 0, 3), note(67, 0, 3), note(50, 0, 3)])
    expect(r.removed).toBe(1)
    expect(r.notes.map((n) => n.midi).sort()).toEqual([60, 67])
  })

  it('소리 구간과 이미 맞는 음은 그대로 두고, 일찍 끝난 음은 소리가 이어지는 만큼 늘린다', () => {
    const pcm = tone([60, 67], 3)
    const exact = refineNotes(pcm, SR, [note(60, 0, 3), note(67, 0, 3)])
    expect(exact.added).toBe(0)
    expect(exact.removed).toBe(0)
    expect(exact.extended).toBe(0)
    const early = refineNotes(pcm, SR, [note(60, 0, 3), note(67, 0, 1.2)]) // 67이 일찍 끝남
    expect(early.added).toBe(0)
    expect(early.extended).toBe(1)
    const g = early.notes.find((n) => n.midi === 67)!
    expect(g.startSec).toBe(0)
    expect(g.startSec + g.durationSec).toBeGreaterThan(2.5)
    expect(early.notes.filter((n) => n.midi === 67)).toHaveLength(1)
  })

  it('조용한 소리·짧은 소리·범위 밖 음에서도 오류 없이 돌려준다', () => {
    expect(refineNotes(new Float32Array(100), SR, [note(60, 0, 1)]).notes).toHaveLength(1) // 분석 창보다 짧음
    const silent = new Float32Array(SR * 2)
    const r = refineNotes(silent, SR, [note(60, 0, 1), note(10, 0, 1)])
    expect(r.added).toBe(0)
    expect(r.notes.some((n) => n.midi === 10)).toBe(true) // 범위 밖 음은 판단하지 않고 둔다
  })

  it('음마다 다른 시간대에 울리면 그 시간대에만 채운다', () => {
    const a = tone([60], 2)
    const b = tone([72], 2)
    const pcm = new Float32Array(a.length + b.length)
    pcm.set(a, 0)
    pcm.set(b, a.length)
    const r = refineNotes(pcm, SR, [note(60, 0, 2)]) // 뒤쪽 72를 놓침
    const g = r.notes.find((n) => n.midi === 72)
    expect(g).toBeTruthy()
    expect(g!.startSec).toBeGreaterThan(1.5)
  })
})
