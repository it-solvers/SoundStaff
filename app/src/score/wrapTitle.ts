const SVG_NS = 'http://www.w3.org/2000/svg'
/** 쪽 양옆에 남길 여백(SVG 단위) */
const SIDE_MARGIN = 40
/** 줄 간격 (글자 크기의 배수) */
const LINE_HEIGHT = 1.25
const MAX_LINES = 6

const fontPx = (el: Element): number => {
  const v = el.getAttribute('font-size') ?? ''
  const n = parseFloat(v)
  return /pt$/.test(v) ? (n * 96) / 72 : n || 0
}

/** 글자 폭에 맞춰 줄을 나눈다. 띄어쓰기에서 먼저 나누고, 한 단어가 폭보다 길면 글자 단위로 나눈다. */
export function splitLines(text: string, fits: (s: string) => boolean): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  const push = (s: string) => {
    if (s) lines.push(s)
  }
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word
    if (fits(next)) {
      cur = next
      continue
    }
    push(cur)
    cur = ''
    if (fits(word)) cur = word
    else {
      for (const ch of word) {
        if (fits(cur + ch)) cur += ch
        else {
          push(cur)
          cur = ch
        }
      }
    }
  }
  push(cur)
  return lines
}

/** 제목 글자 크기를 줄여 볼 단계 (원래 크기의 배율). 보기 좋게 2줄 안에 들어오는 가장 큰 크기를 고른다. */
export const TITLE_SCALES = [1, 0.9, 0.8, 0.7, 0.6, 0.5]
/** 이 줄 수까지는 글자를 줄여서라도 맞춘다 */
const PREFERRED_LINES = 2

export interface TitleLayout {
  lines: string[]
  /** 고른 글자 크기 */
  fontPx: number
  /** 원래 크기에서 줄였는가 */
  shrunk: boolean
}

/**
 * 제목을 쪽 폭(avail)에 맞춘다. 원래 크기로 한 줄에 들어가면 그대로 둔다.
 * 아니면 큰 크기부터 줄여 가며 2줄 안에 들어오는 첫 크기를 쓰고, 가장 작은 크기로도 안 되면 최대 줄 수에서 …로 줄인다.
 * widthAt(글, 글자 크기)는 그 글자 크기에서 글의 폭이다.
 */
export function layoutTitle(
  text: string,
  size: number,
  avail: number,
  widthAt: (s: string, px: number) => number,
  maxLines = MAX_LINES,
): TitleLayout {
  const raw = text.trim()
  const fitsAt = (px: number) => (s: string) => widthAt(s, px) <= avail
  if (!raw || fitsAt(size)(raw)) return { lines: raw ? [raw] : [], fontPx: size, shrunk: false }
  for (const scale of TITLE_SCALES) {
    const px = size * scale
    const lines = splitLines(raw, fitsAt(px))
    if (lines.length <= PREFERRED_LINES) return { lines, fontPx: px, shrunk: scale < 1 }
  }
  const px = size * TITLE_SCALES[TITLE_SCALES.length - 1]
  const fits = fitsAt(px)
  const lines = splitLines(raw, fits)
  if (lines.length > maxLines) {
    lines.length = maxLines
    let last = lines[maxLines - 1]
    while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1)
    lines[maxLines - 1] = `${last}…`
  }
  return { lines, fontPx: px, shrunk: true }
}

/**
 * OSMD는 곡 제목을 한 줄로만 그려서 길면 쪽 폭을 넘어 양옆이 잘린다.
 * 가장 큰 글자(곡 제목)가 쪽 폭을 넘으면 여러 줄로 나누고, 나머지 내용을 그만큼 아래로 내린 뒤 쪽 높이를 늘린다.
 * 제목이 짧으면 아무것도 바꾸지 않는다. 돌려주는 값은 늘어난 높이(없으면 0)이며, 악보 위 재생 커서를 같은 만큼 내리는 데 쓴다.
 */
export function wrapTitle(
  svg: SVGSVGElement,
  /** 글자 폭을 직접 재는 함수. PDF는 실제로 그릴 윤곽선 글꼴로 재야 해서 넘겨 준다. 없으면 브라우저가 잰다. */
  measure?: (text: string, fontPx: number) => number | undefined,
): number {
  const vb = svg.viewBox.baseVal
  if (!vb || !vb.width) return 0
  const texts = Array.from(svg.querySelectorAll<SVGTextElement>('text'))
  let title: SVGTextElement | null = null
  for (const t of texts) if (!title || fontPx(t) > fontPx(title)) title = t
  const raw = title?.textContent?.trim()
  if (!title || !raw || fontPx(title) < 24) return 0

  const avail = vb.width - SIDE_MARGIN * 2
  const size = fontPx(title)
  const parent = title.parentNode as Element
  // 폭을 재는 보이지 않는 글자 요소. 끝까지 화면에 붙여 둬야 폭이 0으로 나오지 않는다.
  const probe = title.cloneNode(false) as SVGTextElement
  probe.setAttribute('visibility', 'hidden')
  parent.appendChild(probe)
  const widthOf = (s: string, px: number) => {
    const m = measure?.(s, px)
    if (m !== undefined) return m
    probe.setAttribute('font-size', `${px}px`)
    probe.textContent = s
    return probe.getComputedTextLength()
  }
  const layout = layoutTitle(raw, size, avail, widthOf)
  if (layout.lines.length === 1 && !layout.shrunk) {
    probe.remove()
    return 0
  }

  const lineH = layout.fontPx * LINE_HEIGHT
  const extra = lineH * (layout.lines.length - 1)
  const baseY = parseFloat(title.getAttribute('y') ?? '0') || 0
  const created = layout.lines.map((line, i) => {
    const el = title.cloneNode(false) as SVGTextElement
    el.textContent = line
    el.setAttribute('font-size', `${layout.fontPx}px`)
    el.setAttribute('y', String(baseY + i * lineH))
    // OSMD는 원래 긴 한 줄 전체의 폭을 기준으로 x를 정해서 그대로 두면 한쪽으로 쏠린다. 줄마다 쪽 가운데에 다시 맞춘다.
    el.setAttribute('x', String(vb.x + (vb.width - widthOf(line, layout.fontPx)) / 2))
    el.removeAttribute('text-anchor')
    return el
  })
  title.replaceWith(...created)
  probe.remove()

  // 나머지 내용을 아래로 내린다 (제목 줄들은 제자리)
  const shift = document.createElementNS(SVG_NS, 'g')
  shift.setAttribute('transform', `translate(0 ${extra})`)
  for (const child of Array.from(svg.childNodes)) {
    if (created.some((c) => c === child || c.contains(child) || (child as Element).contains?.(c))) continue
    if ((child as Element).tagName === 'defs') continue
    shift.appendChild(child)
  }
  svg.appendChild(shift)

  // 쪽 높이를 늘린다
  const newH = vb.height + extra
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${newH}`)
  const h = parseFloat(svg.getAttribute('height') ?? '')
  if (h) svg.setAttribute('height', String(h + extra))
  if (svg.style.height) svg.style.height = `${parseFloat(svg.style.height) + extra}px`
  return extra
}
