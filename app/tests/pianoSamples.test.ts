import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { neededSamples, PIANO_SAMPLES, sampleFor, scheduleSample } from '../src/play/pianoSamples'

const DIR = path.join(import.meta.dirname, '..', 'public', 'piano')

describe('실제 피아노 샘플 (Salamander Grand Piano)', () => {
  it('A0~C8을 단3도 간격으로 30개 갖는다', () => {
    expect(PIANO_SAMPLES).toHaveLength(30)
    expect(PIANO_SAMPLES[0]).toEqual({ name: 'A0', midi: 21 })
    expect(PIANO_SAMPLES[PIANO_SAMPLES.length - 1]).toEqual({ name: 'C8', midi: 108 })
    const gaps = PIANO_SAMPLES.slice(1).map((s, i) => s.midi - PIANO_SAMPLES[i].midi)
    expect(gaps.every((g) => g === 3)).toBe(true)
  })

  it('public/piano에 샘플 파일이 모두 있고 mp3 형식이다', () => {
    for (const s of PIANO_SAMPLES) {
      const file = path.join(DIR, `${s.name}.mp3`)
      expect(fs.existsSync(file), s.name).toBe(true)
      const head = fs.readFileSync(file).subarray(0, 3).toString('latin1')
      expect(head === 'ID3' || fs.readFileSync(file)[0] === 0xff, `${s.name} 형식`).toBe(true)
      expect(fs.statSync(file).size, s.name).toBeGreaterThan(5000)
    }
  })

  it('저작자·라이선스 표시 파일이 함께 있다 (CC BY 3.0)', () => {
    const readme = fs.readFileSync(path.join(DIR, 'README.txt'), 'utf8')
    expect(readme).toContain('Alexander Holm')
    expect(readme).toContain('CC BY 3.0')
  })

  it('sampleFor: 가장 가까운 샘플을 고르고 속도 비율은 2^(차이/12)다', () => {
    expect(sampleFor(60)).toEqual({ name: 'C4', rate: 1 }) // 샘플 위치 그대로
    const up = sampleFor(61) // C#4 → C4 샘플을 반음 올린다
    expect(up.name).toBe('C4')
    expect(up.rate).toBeCloseTo(Math.pow(2, 1 / 12), 6)
    const down = sampleFor(62) // D4 → Ds4(63)가 더 가깝다
    expect(down.name).toBe('Ds4')
    expect(down.rate).toBeCloseTo(Math.pow(2, -1 / 12), 6)
  })

  it('피아노 전 음역에서 샘플과의 차이는 반음 1개 이내다', () => {
    for (let midi = 21; midi <= 108; midi++) {
      const { rate } = sampleFor(midi)
      expect(rate).toBeGreaterThanOrEqual(Math.pow(2, -1 / 12) - 1e-9)
      expect(rate).toBeLessThanOrEqual(Math.pow(2, 1 / 12) + 1e-9)
    }
  })

  it('neededSamples: 곡에서 쓰는 음역의 샘플만 고른다', () => {
    const names = neededSamples([60, 61, 62, 72])
    expect(names.sort()).toEqual(['C4', 'C5', 'Ds4'].sort())
    expect(neededSamples([])).toEqual([])
  })

  it('scheduleSample: 샘플이 있으면 재생 속도를 맞춰 시작·정지하고, 없으면 아무것도 하지 않는다', () => {
    const calls = { sources: 0, rate: 0, started: 0, stopped: 0 }
    const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {} })
    const node = () => ({ connect: (to: unknown) => to })
    const ctx = {
      createBufferSource: () => {
        calls.sources++
        const rate = param()
        return {
          ...node(),
          buffer: null,
          playbackRate: new Proxy(rate, {
            set(t, k, v) {
              if (k === 'value') calls.rate = v as number
              return Reflect.set(t, k, v)
            },
          }),
          start: () => calls.started++,
          stop: () => calls.stopped++,
        }
      },
      createGain: () => ({ ...node(), gain: param() }),
    } as unknown as BaseAudioContext
    const buf = {} as AudioBuffer
    scheduleSample(ctx, {} as AudioNode, new Map([['C4', buf]]), { midi: 61, duration: 1 }, 0)
    expect(calls.sources).toBe(1)
    expect(calls.rate).toBeCloseTo(Math.pow(2, 1 / 12), 6)
    expect(calls.started).toBe(1)
    expect(calls.stopped).toBe(1)
    scheduleSample(ctx, {} as AudioNode, new Map(), { midi: 61, duration: 1 }, 0) // C4 샘플이 없으면 소리를 내지 않는다
    expect(calls.sources).toBe(1)
  })
})
