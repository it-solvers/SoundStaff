import { describe, expect, it } from 'vitest'
import { popupFeatures } from '../src/colabWindow'

const parse = (f: string) => Object.fromEntries(f.split(',').map((kv) => kv.split('=')))

describe('Colab 팝업 창 위치·크기 (popupFeatures)', () => {
  it('넓은 화면: 오른쪽에 너비 60%(최대 1100px)로 붙여 왼쪽에 앱이 남는다', () => {
    const f = parse(popupFeatures({ availWidth: 1920, availHeight: 1080 }))
    expect(+f.width).toBe(1100)
    expect(+f.left + +f.width).toBe(1920)
    expect(+f.left).toBeGreaterThanOrEqual(800) // 앱이 보일 왼쪽 공간
    expect(+f.top + +f.height).toBeLessThanOrEqual(1080)
    expect(f.popup).toBe('yes')
  })
  it('보통 노트북 화면(1440x900): 너비 864px, 오른쪽 끝에 붙는다', () => {
    const f = parse(popupFeatures({ availWidth: 1440, availHeight: 900 }))
    expect(+f.width).toBe(864)
    expect(+f.left).toBe(1440 - 864)
  })
  it('보조 모니터(availLeft가 있는 화면)에서도 그 화면 안에 놓는다', () => {
    const f = parse(popupFeatures({ availWidth: 1920, availHeight: 1080, availLeft: 1920, availTop: 0 }))
    expect(+f.left).toBe(1920 + 1920 - 1100)
  })
  it('아주 작은 화면에서도 너무 작지 않고 음수 위치가 없다', () => {
    const f = parse(popupFeatures({ availWidth: 600, availHeight: 500 }))
    expect(+f.width).toBeGreaterThanOrEqual(480)
    expect(+f.left).toBeGreaterThanOrEqual(0)
    expect(+f.top).toBeGreaterThanOrEqual(0)
  })
})
