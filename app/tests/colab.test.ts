import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COLAB_NOTEBOOK_PATH, COLAB_URL } from '../src/config'

const root = new URL('../../', import.meta.url)
const notebookFile = new URL(COLAB_NOTEBOOK_PATH, root)

describe('고품질 변환(Colab) 노트북', () => {
  it('주소가 저장소의 노트북 파일 위치와 맞다', () => {
    expect(COLAB_URL).toMatch(
      /^https:\/\/colab\.research\.google\.com\/github\/[\w.-]+\/SoundStaff\/blob\/main\/colab\//,
    )
    expect(COLAB_URL.endsWith(COLAB_NOTEBOOK_PATH)).toBe(true)
    expect(fs.existsSync(notebookFile)).toBe(true)
  })

  const nb = JSON.parse(fs.readFileSync(notebookFile, 'utf8')) as {
    nbformat: number
    cells: { cell_type: string; id?: string; source: string[]; outputs?: unknown[] }[]
    metadata: { accelerator?: string }
  }
  const code = nb.cells.filter((c) => c.cell_type === 'code').map((c) => c.source.join(''))

  it('올바른 노트북 형식이고 GPU를 쓰도록 표시돼 있다', () => {
    expect(nb.nbformat).toBe(4)
    expect(nb.metadata.accelerator).toBe('GPU')
    for (const c of nb.cells) expect(c.id, '셀마다 id가 있어야 한다(nbformat 4.5)').toBeTruthy()
    expect(new Set(nb.cells.map((c) => c.id)).size).toBe(nb.cells.length)
    for (const c of nb.cells.filter((x) => x.cell_type === 'code')) expect(c.outputs).toEqual([])
  })

  it('사용자가 누를 코드 칸은 딱 하나이고, 코드는 접혀 있다 (코드를 몰라도 ▶ 한 번이면 끝)', () => {
    const codeCells = nb.cells.filter((c) => c.cell_type === 'code') as unknown as { metadata: { cellView?: string } }[]
    expect(codeCells).toHaveLength(1)
    expect(codeCells[0].metadata.cellView).toBe('form')
    expect(code[0]).toMatch(/^#@title ▶/)
  })

  it('필요한 단계가 순서대로 들어 있다: 설치 → 올리기 → 반주 제거 → MIDI 변환 → 내려받기', () => {
    const all = code.join('\n')
    const order = [
      /pip install[^\n]*demucs/,
      /files\.upload\(/,
      /-m demucs[^\n]*--two-stems=vocals/,
      /predict_and_save\(/,
      /files\.download\(/,
    ].map((re) => all.search(re))
    expect(
      order.every((i) => i >= 0),
      `단계 누락: ${order.join(',')}`,
    ).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(all).toMatch(/pip install[^\n]*basic-pitch/)
  })

  it('오류가 나도 파이썬 오류 목록 대신 쉬운 한글 안내가 나온다', () => {
    const all = code.join('\n')
    expect(all).toMatch(/except RuntimeError/)
    expect(all).toMatch(/except Exception/)
    expect(all).toMatch(/런타임 다시 시작/)
  })

  it('Colab의 !명령 {변수} 치환에 한글 변수 이름을 쓰지 않는다 (치환 실패 방지)', () => {
    for (const s of code) for (const m of s.matchAll(/\{([^}]+)\}/g)) expect(m[1]).not.toMatch(/[가-힣]/)
  })

  it('사용자 파일을 이 앱이나 외부 주소로 보내는 코드가 없다', () => {
    const all = code.join('\n')
    expect(all).not.toMatch(/requests\.|urllib|curl |wget |http:\/\/|\.post\(/)
  })
})
