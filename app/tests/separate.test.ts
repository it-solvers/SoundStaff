import { describe, expect, it } from 'vitest'
import { separateVocals, type SeparationModel } from '../src/audio/separate'

/** 모든 소리를 목소리라고(gain 1) 또는 목소리가 없다고(gain 0) 답하는 가짜 모델 */
const fake =
  (gain: number): SeparationModel =>
  async (mag) =>
    mag.map((v) => v * gain)
/** 두 음이 섞인 소리 */
const signal = (length: number) =>
  Float32Array.from(
    { length },
    (_, i) => 0.4 * Math.sin((2 * Math.PI * 440 * i) / 44100) + 0.2 * Math.sin((2 * Math.PI * 1200 * i) / 44100),
  )

describe('목소리 분리 (separateVocals)', () => {
  // 모델 한 조각(256프레임 ≈ 5.9초)보다 긴 소리로 조각 경계도 확인한다
  const x = signal(44100 * 14)

  it('모두 목소리라고 하면 처음부터 끝까지 원래 소리가 되살아난다', async () => {
    const seen: number[] = []
    const r = await separateVocals(x, x, fake(1), (p) => seen.push(p))
    expect(r.vocals).toHaveLength(x.length)
    let worst = 0
    for (let i = 4096; i < x.length - 4096; i++) worst = Math.max(worst, Math.abs(r.vocals[i] - x[i]))
    expect(worst).toBeLessThan(0.01)
    expect(Math.abs(r.vocals[100] - x[100])).toBeLessThan(0.05)
    expect(r.ratio).toBeGreaterThan(0.99)
    expect(seen.at(-1)).toBe(100)
  }, 20000)

  it('목소리가 없다고 하면 조용해지고 비율이 0에 가깝다', async () => {
    const r = await separateVocals(x, x, fake(0))
    expect(r.ratio).toBeLessThan(0.001)
  }, 20000)
})
