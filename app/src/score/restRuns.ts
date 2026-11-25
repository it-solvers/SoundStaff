/** 쉬는 마디 묶기: 파트보에서 이어지는 쉬는 마디를 숫자 하나가 붙은 한 칸으로 적는다 */
import type { ScoreModel } from './types'

/**
 * 묶을 구간: 첫 마디 번호(0부터) → 마디 수(2 이상).
 * 모든 보표가 온마디 쉼표인 마디가 이어질 때 묶고, 템포나 박자가 바뀌는 마디에서는 끊는다(그 표시가 가려지지 않게).
 */
export function restRuns(model: ScoreModel): Map<number, number> {
  const silent = (mi: number) =>
    model.parts.every((p) => p.staves.every((s) => (s.layout[mi] ?? []).every((v) => v.wholeRest)))
  const changes = (mi: number) => {
    const [prev, cur] = [model.grid[mi - 1], model.grid[mi]]
    return model.tempoByMeasure.has(mi) || prev.numerator !== cur.numerator || prev.denominator !== cur.denominator
  }
  const runs = new Map<number, number>()
  let start = 0
  while (start < model.grid.length) {
    let end = start + 1
    if (silent(start)) {
      while (end < model.grid.length && silent(end) && !changes(end)) end++
      if (end - start > 1) runs.set(start, end - start)
    }
    start = end
  }
  return runs
}

/** 화면에서 한 칸을 차지하는 마디들의 번호 (묶인 구간은 첫 마디만) */
export function visibleMeasures(count: number, runs: Map<number, number>): number[] {
  const out: number[] = []
  for (let mi = 0; mi < count; mi += runs.get(mi) ?? 1) out.push(mi)
  return out
}
