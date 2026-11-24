import type { ScoreModel } from '../score/types'

/** 재생할 음 하나. start·duration은 초 단위(배속 1배 기준) */
export interface PlayNote {
  start: number
  duration: number
  midi: number
  /** 악보 위치(16분음표 칸) */
  step: number
}

export interface Timeline {
  notes: PlayNote[]
  /** 곡 전체 길이(초). 마지막 마디 끝까지 */
  totalSeconds: number
  totalSteps: number
  secondsAtStep(step: number): number
  stepAtSeconds(sec: number): number
}

const DEFAULT_BPM = 120
/** 16분음표 한 칸 = 4분음표의 1/4 */
const STEPS_PER_QUARTER = 4

/**
 * 악보 모델(화면에 보이는 음·길이·템포 그대로)을 초 단위 재생 시간표로 바꾼다.
 * - 템포는 마디 시작에서만 바뀌며 이전 값이 이어진다 (없으면 120).
 * - 붙임줄로 이어진 음은 한 음으로 합쳐 끊김 없이 울린다.
 * - 쉼표는 소리를 내지 않는다.
 */
export function buildTimeline(model: ScoreModel): Timeline {
  const grid = model.grid
  // 마디별 시작 시각과 칸당 시간
  const secPerStep: number[] = []
  const startSec: number[] = []
  let bpm = DEFAULT_BPM
  let t = 0
  grid.forEach((m, i) => {
    bpm = model.tempoByMeasure.get(i) ?? bpm
    const sps = 60 / (bpm * STEPS_PER_QUARTER)
    secPerStep.push(sps)
    startSec.push(t)
    t += m.length * sps
  })
  const totalSeconds = t
  const lastEnd = grid.length ? grid[grid.length - 1].startStep + grid[grid.length - 1].length : 0

  const measureOfStep = (step: number): number => {
    let lo = 0
    let hi = grid.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (grid[mid].startStep <= step) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  const secondsAtStep = (step: number): number => {
    if (!grid.length) return 0
    if (step >= lastEnd) return totalSeconds
    const i = measureOfStep(Math.max(0, step))
    return startSec[i] + (Math.max(0, step) - grid[i].startStep) * secPerStep[i]
  }
  const stepAtSeconds = (sec: number): number => {
    if (!grid.length) return 0
    if (sec >= totalSeconds) return lastEnd
    let i = 0
    while (i + 1 < grid.length && startSec[i + 1] <= sec) i++
    return grid[i].startStep + (Math.max(0, sec) - startSec[i]) / secPerStep[i]
  }

  const notes: PlayNote[] = []
  for (const part of model.parts) {
    part.staves.forEach((staff, si) => {
      const open = new Map<string, { startStep: number; steps: number; midi: number }>()
      const done: { startStep: number; steps: number; midi: number }[] = []
      staff.layout.forEach((voices, mi) => {
        for (const v of voices) {
          let pos = grid[mi]?.startStep ?? 0
          for (const piece of v.pieces) {
            for (const midi of piece.midis) {
              const key = `${part.id}|${si}|${v.voice}|${midi}`
              const cur = open.get(key)
              if (piece.tieStop && cur && cur.startStep + cur.steps === pos) {
                cur.steps += piece.duration
              } else {
                if (cur) done.push(cur)
                open.set(key, { startStep: pos, steps: piece.duration, midi })
              }
              if (!piece.tieStart) {
                const fin = open.get(key)
                if (fin) done.push(fin)
                open.delete(key)
              }
            }
            pos += piece.duration
          }
        }
      })
      done.push(...open.values())
      for (const n of done) {
        const s = secondsAtStep(n.startStep)
        notes.push({
          start: s,
          duration: Math.max(0.03, secondsAtStep(n.startStep + n.steps) - s),
          midi: n.midi,
          step: n.startStep,
        })
      }
    })
  }
  notes.sort((a, b) => a.start - b.start || a.midi - b.midi)
  return { notes, totalSeconds, totalSteps: lastEnd, secondsAtStep, stepAtSeconds }
}
