import { describe, expect, it } from 'vitest'
import { buildTimeline } from '../src/play/timeline'
import { buildScore, defaultSettings } from '../src/score/buildScore'
import { PPQ, info, track } from './helpers'

/** [시작 박, 길이 박, 음높이] → [시작 step, 길이 step, 음높이] (1박 = 4 step) */
const n = (beat: number, beats: number, midi: number): [number, number, number] => [beat * 4, beats * 4, midi]

function build(
  notes: [number, number, number][],
  opts: { bpm?: number; ts?: [number, number]; tempos?: { ticks: number; bpm: number }[] } = {},
) {
  const i = info([track(0, 'A', notes)], {
    tempos: opts.tempos ?? [{ ticks: 0, bpm: opts.bpm ?? 120 }],
    timeSignatures: [{ ticks: 0, numerator: opts.ts?.[0] ?? 4, denominator: opts.ts?.[1] ?? 4 }],
  })
  return buildScore(i, defaultSettings(i)).model
}

describe('재생 시간표 (buildTimeline)', () => {
  it('120BPM 4/4: 4분음표 4개가 0, 0.5, 1.0, 1.5초에 시작하고 길이는 0.5초', () => {
    const tl = buildTimeline(build([n(0, 1, 60), n(1, 1, 62), n(2, 1, 64), n(3, 1, 65)]))
    expect(tl.notes.map((x) => x.midi)).toEqual([60, 62, 64, 65])
    expect(tl.notes.map((x) => +x.start.toFixed(3))).toEqual([0, 0.5, 1, 1.5])
    for (const x of tl.notes) expect(x.duration).toBeCloseTo(0.5, 3)
    expect(tl.totalSeconds).toBeCloseTo(2, 3) // 1마디
  })

  it('60BPM이면 시간이 두 배', () => {
    const tl = buildTimeline(build([n(0, 1, 60), n(1, 1, 62)], { bpm: 60 }))
    expect(tl.notes[1].start).toBeCloseTo(1, 3)
    expect(tl.totalSeconds).toBeCloseTo(4, 3)
  })

  it('쉼표는 소리가 없고 그만큼 시간이 흐른다', () => {
    const tl = buildTimeline(build([n(0, 1, 60), n(2, 1, 62)]))
    expect(tl.notes).toHaveLength(2)
    expect(tl.notes[1].start).toBeCloseTo(1, 3)
  })

  it('화음은 같은 시각에 시작하는 여러 음', () => {
    const tl = buildTimeline(build([n(0, 2, 60), n(0, 2, 64), n(0, 2, 67)]))
    expect(tl.notes.map((x) => x.midi)).toEqual([60, 64, 67])
    expect(new Set(tl.notes.map((x) => x.start)).size).toBe(1)
  })

  it('붙임줄(마디를 넘는 음)은 한 음으로 합쳐 길이를 더한다', () => {
    // 4/4 한 마디 = 4박. 3박째(박 2)에서 시작해 3박 동안 울려 다음 마디로 넘어간다
    const tl = buildTimeline(build([n(2, 3, 60), n(6, 1, 62)]))
    const c = tl.notes.filter((x) => x.midi === 60)
    expect(c).toHaveLength(1)
    expect(c[0].start).toBeCloseTo(1, 3)
    expect(c[0].duration).toBeCloseTo(1.5, 3)
  })

  it('6/8 박자: 한 마디는 점4분음표 2개 = 1.5초(120BPM)', () => {
    const tl = buildTimeline(build([n(0, 1.5, 60), n(1.5, 1.5, 62), n(3, 1.5, 64)], { ts: [6, 8] }))
    expect(tl.notes.map((x) => +x.start.toFixed(3))).toEqual([0, 0.75, 1.5])
  })

  it('중간에 템포가 바뀌면 그 마디부터 빨라진다 (120 → 240BPM)', () => {
    const tl = buildTimeline(
      build([n(0, 1, 60), n(4, 1, 62), n(8, 1, 64)], {
        tempos: [
          { ticks: 0, bpm: 120 },
          { ticks: 4 * PPQ, bpm: 240 },
        ],
      }),
    )
    expect(tl.notes[1].start).toBeCloseTo(2, 3) // 첫 마디 2초
    expect(tl.notes[2].start).toBeCloseTo(3, 3) // 둘째 마디는 1초
  })

  it('시간 ↔ 위치 변환이 서로 역변환이다', () => {
    const tl = buildTimeline(
      build([n(0, 1, 60), n(4, 1, 62), n(8, 1, 64)], {
        tempos: [
          { ticks: 0, bpm: 90 },
          { ticks: 4 * PPQ, bpm: 150 },
        ],
      }),
    )
    for (const step of [0, 3, 16, 17, 31, 40]) expect(tl.stepAtSeconds(tl.secondsAtStep(step))).toBeCloseTo(step, 6)
    expect(tl.secondsAtStep(10_000)).toBeCloseTo(tl.totalSeconds, 6)
  })

  it('악보에 있는 음은 하나도 빠지지 않는다', () => {
    const notes = [n(0, 1, 60), n(1, 1, 62), n(2, 2, 64), n(4, 1, 65), n(5, 3, 67)]
    expect(buildTimeline(build(notes)).notes.map((x) => x.midi)).toEqual([60, 62, 64, 65, 67])
  })
})
