/**
 * 악보에서 악기(트랙) 단을 쌓는 순서.
 * order는 트랙 번호(track.index)를 원하는 순서로 나열한 목록이다. 비어 있거나 없으면 원래 순서(파일 순서, 파일 안의 트랙 순서)다.
 * order에 없는 트랙(나중에 추가된 파일 등)은 원래 순서대로 맨 뒤에 붙고, 없는 번호나 중복은 무시한다.
 */
export function orderBy<T>(items: T[], getIndex: (x: T) => number, order?: number[]): T[] {
  if (!order || order.length === 0) return items
  const rank = new Map<number, number>()
  for (const idx of order) if (!rank.has(idx)) rank.set(idx, rank.size)
  const keyed = items.map((x, i) => ({ x, i, r: rank.get(getIndex(x)) ?? rank.size + i }))
  keyed.sort((a, b) => a.r - b.r)
  return keyed.map((k) => k.x)
}

/** 목록에서 from 자리의 항목을 to 자리로 옮긴 새 목록 (범위를 벗어나면 그대로) */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** 원래 순서와 같은가 (같으면 "바꾸지 않음"으로 저장하지 않는다) */
export function sameOrder(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}
