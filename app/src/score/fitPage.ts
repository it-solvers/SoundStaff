/**
 * 악기가 많으면 한 줄(모든 보표를 쌓은 묶음)이 쪽보다 높아져 아래가 잘린다. OSMD는 크기를 줄이지 않으므로
 * 그린 결과를 재서 넘치면 악보를 작게 해 다시 그린다.
 */

/** 쪽 높이에서 악보가 차지할 수 있는 비율. 나머지는 아래 여백과 쪽 번호 자리 */
export const PAGE_FILL_LIMIT = 0.95
const MIN_ZOOM = 0.15
const MAX_TRIES = 8

/**
 * render(zoom)이 알려 주는 "가장 아래 그림의 위치 / 쪽 높이"가 한도 안에 들 때까지 zoom을 줄인다.
 * 넘친 비율만큼 줄이되(조금 더 여유 있게), 줄 나눔이 달라지므로 다시 재서 확인한다. 마지막에 쓴 zoom을 돌려준다.
 */
export function fitZoom(start: number, render: (zoom: number) => number): number {
  let zoom = start
  for (let i = 0; ; i++) {
    const fill = render(zoom)
    if (fill <= PAGE_FILL_LIMIT || zoom <= MIN_ZOOM || i >= MAX_TRIES) return zoom
    zoom = Math.max(MIN_ZOOM, zoom * Math.min(0.95, (PAGE_FILL_LIMIT / fill) * 0.98))
  }
}

/** 쪽마다 가장 아래에 그린 것의 위치를 쪽 높이로 나눈 값 중 가장 큰 것. 배경(쪽 전체를 덮는 사각형)은 세지 않는다 */
export function pageFill(pages: SVGSVGElement[]): number {
  let worst = 0
  for (const svg of pages) {
    const vb = svg.viewBox.baseVal
    const top = vb?.height ? vb.y : 0
    const height = vb?.height || svg.getBoundingClientRect().height
    for (const el of Array.from(svg.querySelectorAll<SVGGraphicsElement>('path, text'))) {
      const box = el.getBBox()
      if (box.height >= height) continue
      worst = Math.max(worst, (box.y + box.height - top) / height)
    }
  }
  return worst
}
