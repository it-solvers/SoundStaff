/**
 * 악기가 많으면 한 줄(모든 보표를 쌓은 묶음)이 쪽보다 높아져 아래가 잘린다. OSMD는 크기를 줄이지 않으므로
 * 그린 결과를 재서 넘치면 악보를 작게 해 다시 그린다.
 */

/** 쪽 높이에서 악보가 차지할 수 있는 비율. 나머지는 아래 여백과 쪽 번호 자리 */
export const PAGE_FILL_LIMIT = 0.95
/** 쪽수가 정해진 배치에서 쪽이 넘쳤을 때 "넘침"으로 알리는 값 (크기를 15%쯤 줄여 다시 그리게 된다) */
export const OVERFLOW_FILL = 1.1
const RIGHT_LIMIT = 0.995
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

/**
 * 쪽마다 가장 아래(와 가장 오른쪽)에 그린 것의 위치를 쪽 크기로 나눈 값 중 가장 큰 것. 1에 가까울수록 꽉 찬 것이다.
 * 오른쪽은 여백이 좁아 RIGHT_LIMIT를 한도로 본다. 배경(쪽 전체를 덮는 사각형)은 세지 않는다
 */
export function pageFill(pages: SVGSVGElement[]): number {
  let worst = 0
  for (const svg of pages) {
    const vb = svg.viewBox.baseVal
    const top = vb?.height ? vb.y : 0
    const height = vb?.height || svg.getBoundingClientRect().height
    const left = vb?.width ? vb.x : 0
    const width = vb?.width || svg.getBoundingClientRect().width
    for (const el of Array.from(svg.querySelectorAll<SVGGraphicsElement>('path, text'))) {
      const box = el.getBBox()
      if (box.height >= height) continue
      const right = (box.x + box.width - left) / width
      worst = Math.max(worst, (box.y + box.height - top) / height, (right * PAGE_FILL_LIMIT) / RIGHT_LIMIT)
    }
  }
  return worst
}
