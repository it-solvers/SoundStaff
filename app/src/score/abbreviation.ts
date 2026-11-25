/**
 * 둘째 줄부터 보표 앞에 붙이는 악기 이름 줄임말 (총보 관례). 연주자가 어느 쪽을 펴도 자기 보표를 찾게 한다.
 */
import type { PartModel } from './types'

/** [여기까지의 GM 번호, 줄임말] — 앞에서부터 처음 맞는 줄을 쓴다 */
const BY_PROGRAM: [last: number, abbr: string][] = [
  [3, 'Pno.'], [5, 'E.Pno.'], [6, 'Hpsd.'], [7, 'Clav.'], [8, 'Cel.'], [9, 'Glock.'], [10, 'M.Box'],
  [11, 'Vib.'], [12, 'Mar.'], [13, 'Xyl.'], [14, 'Bells'], [15, 'Dulc.'], [20, 'Org.'], [21, 'Acc.'],
  [22, 'Harm.'], [23, 'Band.'], [25, 'Gtr.'], [31, 'E.Gtr.'], [39, 'Bass'], [40, 'Vln.'], [41, 'Vla.'],
  [42, 'Vc.'], [43, 'Cb.'], [44, 'Trem.'], [45, 'Pizz.'], [46, 'Hp.'], [47, 'Timp.'], [49, 'Str.'],
  [51, 'Syn.Str.'], [54, 'Choir'], [55, 'Hit'], [56, 'Tpt.'], [57, 'Tbn.'], [58, 'Tuba'], [59, 'M.Tpt.'],
  [60, 'Hn.'], [63, 'Brass'], [67, 'Sax'], [68, 'Ob.'], [69, 'E.Hn.'], [70, 'Bsn.'], [71, 'Cl.'],
  [72, 'Picc.'], [73, 'Fl.'], [74, 'Rec.'], [79, 'Wind'], [87, 'Lead'], [95, 'Pad'], [103, 'FX'],
] // prettier-ignore

/** 이 길이 이하의 이름은 줄이지 않는다 */
const SHORT = 7

function shorten(name: string): string {
  const chars = Array.from(name)
  return chars.length <= SHORT
    ? name
    : `${chars
        .slice(0, SHORT - 1)
        .join('')
        .trim()}.`
}

/**
 * 파트마다 줄임말을 정한다. 파일에 붙은 트랙 이름이 없어 악기 이름을 그대로 쓴 파트는 악기 번호의 관용 줄임말을,
 * 사용자가 붙인 이름(Soprano 등)은 그 이름을 줄여 쓴다. 같은 줄임말이 겹치면 번호를 붙인다.
 */
export function abbreviations(parts: PartModel[]): string[] {
  const base = parts.map((p) => {
    if (Array.from(p.name).length <= SHORT) return p.name
    if (p.percussion) {
      if (p.name === 'Drum Set') return 'D.Set'
      return /^[A-Za-z]/.test(p.name) ? `${p.name.slice(0, 4)}.` : shorten(p.name)
    }
    const standard = p.name === p.instrumentName ? BY_PROGRAM.find(([last]) => p.program <= last)?.[1] : undefined
    return standard ?? shorten(p.name)
  })
  const seen = new Map<string, number>()
  return base.map((a) => {
    if (base.filter((x) => x === a).length < 2) return a
    const n = (seen.get(a) ?? 0) + 1
    seen.set(a, n)
    return `${a} ${n}`
  })
}
