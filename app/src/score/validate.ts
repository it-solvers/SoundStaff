import type { ScoreModel } from './types'

export interface Validation {
  ok: boolean
  errors: string[]
}

/**
 * 악보 모델의 구조 검사: 마디마다 성부 길이의 합이 박자표와 일치하는지, 붙임줄이 짝을 이루는지.
 * (기획서 8.3: 마디마다 음 길이의 합이 박자표와 정확히 일치해야 한다)
 */
export function validateModel(model: ScoreModel): Validation {
  const errors: string[] = []
  for (const part of model.parts) {
    part.staves.forEach((staff, si) => {
      const open = new Map<number, string>() // 성부 → 열린 붙임줄의 음높이 목록
      const where = part.staves.length > 1 ? `${part.name} ${si + 1}단` : part.name
      staff.layout.forEach((voices, mi) => {
        const len = model.grid[mi].length
        for (const vm of voices) {
          const sum = vm.wholeRest ? len : vm.pieces.reduce((a, p) => a + p.duration, 0)
          if (sum !== len) errors.push(`${where}: ${mi + 1}마디 ${vm.voice}성부 길이 ${sum} ≠ 마디 길이 ${len}`)
          if (!vm.wholeRest) {
            for (const p of vm.pieces) {
              const key = p.midis.join(',')
              if (p.tieStop && open.get(vm.voice) !== key)
                errors.push(`${where}: ${mi + 1}마디 ${vm.voice}성부 붙임줄 시작 없이 끝남`)
              if (p.tieStop) open.delete(vm.voice)
              if (p.tieStart) open.set(vm.voice, key)
            }
          }
        }
      })
      if (open.size) errors.push(`${where}: 끝나지 않은 붙임줄이 있습니다`)
    })
  }
  return { ok: errors.length === 0, errors }
}

/** 생성한 XML이 올바른 XML 문서인지(브라우저 파서) 확인한다 */
export function validateXmlWellFormed(xml: string): Validation {
  if (typeof DOMParser === 'undefined') return { ok: true, errors: [] }
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const err = doc.getElementsByTagName('parsererror')[0]
  return err ? { ok: false, errors: [`XML 형식 오류: ${err.textContent?.slice(0, 200)}`] } : { ok: true, errors: [] }
}
