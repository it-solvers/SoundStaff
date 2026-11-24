const SVG_NS = 'http://www.w3.org/2000/svg'
/** 쪽 양옆에 남길 여백(SVG 단위) */
const SIDE_MARGIN = 40
/** 줄 간격 (글자 크기의 배수) */
const LINE_HEIGHT = 1.25
const MAX_LINES = 4

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
  const probe = title.cloneNode(false) as SVGTextElement
  probe.setAttribute('visibility', 'hidden')
  title.parentNode?.appendChild(probe)
  const widthOf = (s: string, px: number) => {
    const m = measure?.(s, px)
    if (m !== undefined) return m
    probe.textContent = s
    return probe.getComputedTextLength()
  }
  const fits = (s: string) => widthOf(s, fontPx(title)) <= avail
  const needsWrap = !fits(raw)
  const lines = needsWrap ? splitLines(raw, fits) : [raw]
  probe.remove()
  if (!needsWrap || lines.length < 2) return 0
  if (lines.length > MAX_LINES) {
    // 너무 길면 마지막 줄을 줄여서 …로 끝낸다
    lines.length = MAX_LINES
    let last = lines[MAX_LINES - 1]
    while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1)
    lines[MAX_LINES - 1] = `${last}…`
  }

  const size = fontPx(title)
  const lineH = size * LINE_HEIGHT
  const extra = lineH * (lines.length - 1)
  const baseY = parseFloat(title.getAttribute('y') ?? '0') || 0
  const parent = title.parentNode as Element
  const created = lines.map((line, i) => {
    const el = title.cloneNode(false) as SVGTextElement
    el.textContent = line
    el.setAttribute('y', String(baseY + i * lineH))
    return el
  })
  title.replaceWith(...created)
  // OSMD는 긴 한 줄 전체의 폭을 기준으로 x를 정해서 줄을 나누면 한쪽으로 쏠린다. 줄마다 쪽 가운데에 다시 맞춘다.
  for (const el of created) {
    parent.appendChild(el) // 화면에 붙어 있어야 폭을 잴 수 있다 (replaceWith로 이미 붙어 있으면 제자리)
    const w = widthOf(el.textContent ?? '', size)
    el.setAttribute('x', String(vb.x + (vb.width - w) / 2))
    el.removeAttribute('text-anchor')
  }

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
