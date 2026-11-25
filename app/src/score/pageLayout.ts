/** PDF의 마디 배치와 둘째 쪽부터의 제목 */

/** 곡의 마디 수 (첫 파트 기준) */
export function measureCount(xml: string): number {
  const end = xml.indexOf('</part>')
  return end < 0 ? 0 : (xml.slice(0, end).match(/<measure number="/g)?.length ?? 0)
}

/** 한 줄에 쌓이는 보표 수 (두 보표 파트는 2로 센다) */
export function staffCount(xml: string): number {
  const parts = xml.match(/<part id=/g)?.length ?? 0
  const extra = [...xml.matchAll(/<staves>(\d+)<\/staves>/g)].reduce((a, m) => a + Number(m[1]) - 1, 0)
  return parts + extra
}

/** MusicXML에 적힌 곡 제목 */
export function workTitle(xml: string): string {
  const raw = /<work-title>([^<]*)<\/work-title>/.exec(xml)?.[1] ?? ''
  const entities: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
  return raw.replace(/&(lt|gt|amp|quot|apos);/g, (_, name: string) => entities[name])
}

/** 폭에 넘치면 뒤를 …로 줄인다 */
export function ellipsize(text: string, maxWidth: number, width: (s: string) => number): string {
  if (width(text) <= maxWidth) return text
  const chars = Array.from(text)
  while (chars.length && width(`${chars.join('')}…`) > maxWidth) chars.pop()
  return `${chars.join('')}…`
}
