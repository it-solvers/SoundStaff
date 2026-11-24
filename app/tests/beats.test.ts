import { describe, expect, it } from 'vitest'
import {
  anchorBeats,
  beatPosition,
  measureTempos,
  tempoMarks,
  trackBeatsFromEnvelope,
  usefulBeatTimes,
} from '../src/audio/beats'
import { audioToInfo, toNoteEvents, AUDIO_PPQ } from '../src/audio/toInfo'
import type { AudioNote } from '../src/midi/types'
import { materializeAudio } from '../src/score/audioInfo'
import { applySettings } from '../src/score/settings'

const HOP = 0.01
/** 박 시각마다 온셋(세기 1)이 있는 가짜 온셋 곡선 */
const envAt = (beats: number[], total: number) => {
  const env = new Float32Array(Math.round(total / HOP))
  for (const b of beats) env[Math.round(b / HOP)] = 1
  return env
}
/** 처음 steady박은 period초 간격, 그다음 rit박은 period×1.5까지 늘어나는 박 시각 */
const ritBeats = (period: number, steady: number, rit: number) => {
  const out = [0]
  for (let i = 0; i < steady; i++) out.push(out[out.length - 1] + period)
  for (let i = 1; i <= rit; i++) out.push(out[out.length - 1] + period * (1 + (0.5 * i) / rit))
  for (let i = 0; i < steady; i++) out.push(out[out.length - 1] + period * 1.5)
  return out
}
const an = (startSec: number, durationSec: number, midi: number): AudioNote => ({
  startSec,
  durationSec,
  midi,
  velocity: 0.7,
})

describe('박 추적 (trackBeatsFromEnvelope)', () => {
  it('일정한 박을 그대로 찾는다', () => {
    const beats = Array.from({ length: 30 }, (_, i) => i * 0.5)
    const found = trackBeatsFromEnvelope(envAt(beats, 15.5), HOP, 120)
    expect(found.length).toBeGreaterThanOrEqual(28)
    const iv = found.slice(1).map((t, i) => t - found[i])
    expect(iv.every((v) => Math.abs(v - 0.5) < 0.03)).toBe(true)
  })

  it('점점 느려지는 연주를 따라간다: 박을 하나 더 끼워 넣지 않아 박의 수가 맞는다', () => {
    const truth = ritBeats(0.5, 10, 6)
    // 끝에 무음이 길게 남아도(2초) 마지막 박까지 찾는다
    const found = trackBeatsFromEnvelope(envAt(truth, truth[truth.length - 1] + 2), HOP, 120)
    // 박마다 온셋이 있으므로 찾은 박 수가 실제와 같아야 한다 (끼워 넣거나 빼먹지 않는다)
    expect(Math.abs(found.length - truth.length)).toBeLessThanOrEqual(1)
    expect(Math.abs(found[found.length - 1] - truth[truth.length - 1])).toBeLessThan(0.1)
  })

  it('너무 짧은 입력이나 이상한 템포는 빈 배열', () => {
    expect(trackBeatsFromEnvelope(new Float32Array(10), HOP, 120)).toEqual([])
    expect(trackBeatsFromEnvelope(new Float32Array(1000), HOP, 0)).toEqual([])
  })
})

describe('박 지도 (anchorBeats, beatPosition, tempoMarks, usefulBeatTimes)', () => {
  const steady = Array.from({ length: 40 }, (_, i) => 0.06 + i * 0.5)

  it('시각 0에 가장 가까운 박이 0번 박이 된다', () => {
    const times = anchorBeats([-0.9, -0.4, 0.1, 0.6, 1.1, 1.6, 2.1, 2.6, 3.1, 3.6])!
    expect(times[0]).toBeCloseTo(0.1)
    expect(anchorBeats([0, 1, 2])).toBeNull() // 박이 8개 미만
  })

  it('beatPosition: 박 사이는 직선으로 잇고, 앞뒤는 가까운 박 간격으로 늘린다', () => {
    const t = [0, 1, 3, 4, 5, 6, 7, 8]
    expect(beatPosition(t, 0)).toBe(0)
    expect(beatPosition(t, 2)).toBeCloseTo(1.5) // 1~3초 사이(한 박이 2초)의 가운데
    expect(beatPosition(t, 8.5)).toBeCloseTo(7.5)
    expect(beatPosition(t, -1)).toBeCloseTo(-1)
  })

  it('measureTempos·tempoMarks: 일정한 템포는 표시가 하나, 느려지면 표시가 늘어난다', () => {
    expect(measureTempos(steady).every((v) => Math.abs(v - 120) < 0.01)).toBe(true)
    expect(tempoMarks(steady)).toEqual([{ beat: 0, bpm: 120 }])
    const slow = ritBeats(0.5, 8, 4)
    const marks = tempoMarks(slow)
    expect(marks[0]).toEqual({ beat: 0, bpm: 120 })
    expect(marks.length).toBeGreaterThan(1)
    expect(marks[marks.length - 1].bpm).toBeLessThan(100)
  })

  it('usefulBeatTimes: 일정한 템포면 null, 눈에 띄게 변하면 박 지도, 추정 템포와 8% 넘게 다르면 null', () => {
    expect(usefulBeatTimes(steady, 120)).toBeNull()
    // 대부분 120BPM이고 일부 마디만 느려진 연주 (박 간격의 중앙값이 추정 템포와 같다)
    const slow = ritBeats(0.5, 24, 4).slice(0, 34)
    expect(usefulBeatTimes(slow, 120)).not.toBeNull()
    expect(usefulBeatTimes(slow, 90)).toBeNull() // 추정 템포가 실제와 다르면 쓰지 않는다
  })
})

describe('박 지도를 악보 변환에 쓴다', () => {
  const rit = ritBeats(0.5, 8, 4)

  it('toNoteEvents: 박 지도가 있으면 느려진 구간의 음도 박 위치에 놓인다', () => {
    const lastBeat = rit[rit.length - 1]
    const ev = toNoteEvents([an(lastBeat, 1, 60)], 120, rit)[0]
    expect(ev.ticks).toBe(Math.round((rit.length - 1) * AUDIO_PPQ)) // 마지막 박 번호
    // 일정한 템포(120BPM)로 환산하면 느려진 만큼 박 위치가 뒤로 밀린다
    expect(toNoteEvents([an(lastBeat, 1, 60)], 120)[0].ticks).toBeGreaterThan(ev.ticks)
  })

  const info = (beatTimes?: number[]) =>
    audioToInfo({
      fileName: 'r.wav',
      size: 1,
      durationSec: 20,
      notes: [],
      allNotes: [an(0, 0.4, 60), an(0.5, 0.4, 62), an(rit[rit.length - 1], 1, 64)],
      detectedCount: 3,
      bpm: { value: 120, confidence: 0.5 },
      beatTimes,
      key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })

  it('audioToInfo: 박 지도에서 템포 표시(틱 위치 포함)를 만든다', () => {
    const i = info(rit)
    expect(i.tempos[0]).toEqual({ ticks: 0, bpm: 120 })
    expect(i.tempos.length).toBeGreaterThan(1)
    expect(i.tempos.every((t) => t.ticks % (4 * AUDIO_PPQ) === 0)).toBe(true)
    expect(info().tempos).toEqual([{ ticks: 0, bpm: 120 }]) // 박 지도가 없으면 예전처럼 하나
  })

  it('materializeAudio: 템포를 직접 고치면 박 지도를 쓰지 않고 그 템포로 환산한다', () => {
    const i = info(rit)
    const mapped = materializeAudio(i, applySettings(i))
    expect(mapped.tempos.length).toBeGreaterThan(1)
    const manual = materializeAudio(i, applySettings(i, { tempo: 100 }))
    expect(manual.tempos).toEqual([{ ticks: 0, bpm: 100 }])
    const last = (x: typeof mapped) => Math.max(...x.tracks.flatMap((tr) => tr.notes.map((n) => n.ticks)))
    expect(last(manual)).not.toBe(last(mapped))
  })
})
