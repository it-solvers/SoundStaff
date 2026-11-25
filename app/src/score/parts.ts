/** 파트보: 총보에서 악기 하나씩만 담은 악보. 연주자에게 나눠 준다 */
import { safeFileName } from '../utils/fileName'
import { toMusicXml } from './toMusicXml'
import type { ScoreModel } from './types'

export interface PartScore {
  /** ZIP 안 파일 이름의 바탕: "곡 - 01 악기" (번호는 총보에 쌓인 순서) */
  base: string
  xml: string
}

/** 마디·템포·조표·줄바꿈은 총보와 같고, 제목 뒤에 악기 이름을 붙인다 */
export function partScores(model: ScoreModel, base: string): PartScore[] {
  const digits = Math.max(2, String(model.parts.length).length)
  return model.parts.map((part, i) => ({
    base: safeFileName(`${base} - ${String(i + 1).padStart(digits, '0')} ${part.name}`),
    // 연주자가 세기 쉽게 이어지는 쉬는 마디는 숫자로 묶는다
    xml: toMusicXml({ ...model, title: `${model.title} - ${part.name}`, parts: [part] }, { groupRests: true }),
  }))
}
