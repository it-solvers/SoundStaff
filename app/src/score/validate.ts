import { t } from '../text'
import { startsTie, stopsTie } from '../midi/measures'
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
      const open = new Map<number, Set<number>>() // 성부 → 열린 붙임줄의 음높이 집합
      const where = part.staves.length > 1 ? t.errors.validation.staff(part.name, si + 1) : part.name
      staff.layout.forEach((voices, mi) => {
        const len = model.grid[mi].length
        for (const vm of voices) {
          const sum = vm.wholeRest ? len : vm.pieces.reduce((a, p) => a + p.duration, 0)
          if (Math.abs(sum - len) > 1e-6) errors.push(t.errors.validation.length(where, mi + 1, vm.voice, sum, len))
          if (!vm.wholeRest) {
            for (const p of vm.pieces) {
              const cur = open.get(vm.voice) ?? new Set<number>()
              // 붙임줄은 음마다 따로 본다: 끝나는 음은 앞에서 시작한 붙임줄이 있어야 하고, 끝나지 않은 붙임줄은 마지막에 확인한다
              if (p.midis.some((m) => stopsTie(p, m) && !cur.has(m)))
                errors.push(t.errors.validation.tieNoStart(where, mi + 1, vm.voice))
              const next = new Set<number>()
              for (const m of p.midis) if (startsTie(p, m)) next.add(m)
              if (next.size) open.set(vm.voice, next)
              else open.delete(vm.voice)
            }
          }
        }
      })
      if (open.size) errors.push(t.errors.validation.openTie(where))
    })
  }
  return { ok: errors.length === 0, errors }
}

/** 생성한 XML이 올바른 XML 문서인지(브라우저 파서) 확인한다 */
export function validateXmlWellFormed(xml: string): Validation {
  if (typeof DOMParser === 'undefined') return { ok: true, errors: [] }
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const err = doc.getElementsByTagName('parsererror')[0]
  return err
    ? { ok: false, errors: [t.errors.validation.xml(err.textContent?.slice(0, 200) ?? '')] }
    : { ok: true, errors: [] }
}
