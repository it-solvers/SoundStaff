import { assetUrl } from '../utils/assetUrl'
import { jsPDF } from 'jspdf'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { svg2pdf } from 'svg2pdf.js'
import { t } from '../text'
import { UserError } from '../utils/errors'
import { wrapTitle } from './wrapTitle'
import { fitZoom, OVERFLOW_FILL, pageBounds, pageFill, TOP_MARGIN_PT } from './fitPage'
import { parseOutlineFont, textToPathData, textWidth, type OutlineFont, type TextAnchor } from './outlineText'
import { ellipsize, measureCount, staffCount, workTitle } from './pageLayout'
import { DEFAULT_PDF_SETTINGS, MEASURES_PER_LINE, SIZE_ZOOM, type PdfSettings } from './pdfSettings'

const FONT_FILE = 'SoundStaffKR-Regular.ttf'
/** 기본 글꼴(Latin-1)로 그릴 수 없는 글자(한글 등)가 들어 있는지 */
const NEEDS_CJK = /[\u0100-\uffff]/
const SVG_NS = 'http://www.w3.org/2000/svg'
/** 이 수 이상의 보표는 한 쪽에 한 줄만 들어간다고 본다 */
const CROWDED_STAVES = 6
const A4_PT = { short: 595.28, long: 841.89 }
/** 쪽 아래에 남기는 여백 (쪽 높이에 대한 비율, 쪽 번호 자리) */
const BOTTOM_MARGIN = 0.07

let fontPromise: Promise<OutlineFont> | null = null

/** 한글 윤곽선을 만들 글꼴을 한 번만 내려받아 읽는다 (이 브라우저 안에서만 쓰고 어디로도 보내지 않는다) */
function loadOutlineFont(): Promise<OutlineFont> {
  fontPromise ??= (async () => {
    const res = await fetch(assetUrl(`fonts/${FONT_FILE}`))
    if (!res.ok) throw new UserError(t.errors.pdfFont)
    return parseOutlineFont(await res.arrayBuffer())
  })().catch((e) => {
    fontPromise = null // 실패하면 다음에 다시 시도한다
    throw e
  })
  return fontPromise
}

/** 한글이 든 <text>를 같은 자리의 윤곽선 <path>로 바꾼다 */
function textToOutline(el: SVGTextElement, font: OutlineFont): void {
  const text = el.textContent ?? ''
  const px = (name: string, fallback: number) => parseFloat(el.getAttribute(name) ?? '') || fallback
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute(
    'd',
    textToPathData(
      font,
      text,
      px('x', 0),
      px('y', 0),
      px('font-size', 16),
      (el.getAttribute('text-anchor') as TextAnchor) ?? 'start',
    ),
  )
  path.setAttribute('fill', el.getAttribute('fill') ?? '#000')
  const transform = el.getAttribute('transform')
  if (transform) path.setAttribute('transform', transform)
  el.replaceWith(path)
}

/** 둘째 쪽부터 오른쪽 위에 작은 글씨로 곡 제목을 쓴다 (한글도 보이도록 윤곽선으로) */
async function drawRunningTitle(pdf: jsPDF, font: OutlineFont, title: string) {
  const [width, height, size, margin] = [pdf.internal.pageSize.getWidth(), 24, 9, 30]
  const text = ellipsize(title, width * 0.6, (s) => textWidth(font, s, size))
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', textToPathData(font, text, width - margin, 17, size, 'end'))
  path.setAttribute('fill', '#444')
  svg.appendChild(path)
  await svg2pdf(svg, pdf, { x: 0, y: 0, width, height })
}

/**
 * svg2pdf가 읽지 못하는 글자 표기를 읽을 수 있는 형태로 바꾼다.
 * OSMD는 템포 표시(♩ = 100)만 `14pt`, `times`, `xml:space="preserve"`, 앞 공백으로 그려서
 * 그대로 변환하면 PDF에서 숫자가 빠진다. 다른 글자처럼 px 크기와 일반 글꼴 이름으로 맞춘다.
 */
function normalizeText(t: SVGTextElement): void {
  const size = t.getAttribute('font-size')
  const pt = size && /^([\d.]+)pt$/.exec(size)
  if (pt) t.setAttribute('font-size', `${(parseFloat(pt[1]) * 96) / 72}px`)
  if (t.getAttribute('font-family') === 'times') t.setAttribute('font-family', 'Times New Roman')
  if (t.hasAttribute('xml:space')) {
    t.removeAttribute('xml:space')
    const text = t.textContent ?? ''
    const lead = text.length - text.trimStart().length
    if (lead > 0) {
      // 앞 공백을 없애는 대신 그만큼 오른쪽으로 옮겨 ♩와 숫자 사이 간격을 유지한다
      const fontPx = parseFloat(t.getAttribute('font-size') ?? '16') || 16
      t.setAttribute('x', String(parseFloat(t.getAttribute('x') ?? '0') + lead * fontPx * 0.25))
      t.textContent = text.trimStart()
    }
  }
}

/**
 * MusicXML을 A4 세로 페이지로 나눠 그린 뒤 벡터 PDF로 만든다.
 * - 악보(음표·오선)는 SVG 경로라 확대해도 선명하다.
 * - 한글이 들어간 글자(곡 제목, 트랙 이름, 작곡자)는 글꼴 내장 대신 윤곽선으로 그려 어떤 PDF 뷰어에서도 보이게 한다.
 * - 모든 처리는 브라우저 안에서 하며 서버로 보내지 않는다.
 */
export async function exportScorePdf(xml: string, settings: PdfSettings = DEFAULT_PDF_SETTINGS): Promise<Blob> {
  const landscape = settings.orientation === 'landscape'
  const container = document.createElement('div')
  container.style.cssText = `position:fixed;left:-20000px;top:0;width:${landscape ? 1200 : 900}px;background:#fff`
  document.body.appendChild(container)
  const osmd = new OpenSheetMusicDisplay(container, {
    percussionOneLineCutoff: 0, // 타악기도 항상 5줄 보표
    drawPartAbbreviations: true, // 둘째 줄부터도 악기 줄임말을 붙인다
    autoResize: false,
    drawTitle: true,
    autoBeam: true,
    pageFormat: landscape ? 'A4 L' : 'A4 P',
    pageBackgroundColor: '#FFFFFF',
    // 한 줄에 4마디: 쉬는 마디를 숫자로 묶지 않는다(묶으면 한 줄의 마디 수가 달라진다)
    ...(settings.layout === 'four' ? { autoGenerateMultipleRestMeasuresFromRestMeasures: false } : {}),
  })
  const rules = osmd.EngravingRules
  if (settings.layout === 'four') {
    rules.RenderXMeasuresPerLineAkaSystem = MEASURES_PER_LINE
    rules.StretchLastSystemLine = true // 마지막 줄도 쪽 폭을 채워 마침 세로줄이 오른쪽 끝에 오게 한다
    // 보표가 많으면 악보가 지나치게 작아지지 않게 음표 사이를 좁힌다 (보표가 적을 때 좁히면 음표가 겹친다)
    if (staffCount(xml) >= CROWDED_STAVES) {
      rules.VoiceSpacingMultiplierVexflow = 0.7
      rules.VoiceSpacingAddendVexflow = 2
    }
  }
  try {
    await osmd.load(xml)
    const drawn = () => Array.from(container.querySelectorAll<SVGSVGElement>(':scope > div > svg, :scope > svg'))
    // 한 줄에 4마디 배치에서 만들어져야 할 줄 수. 이보다 많으면 4마디가 한 줄에 못 들어간 것이다
    const wanted = settings.layout === 'four' ? Math.ceil(measureCount(xml) / MEASURES_PER_LINE) : Infinity
    const lines = () => osmd.GraphicSheet.MusicPages.reduce((a, p) => a + p.MusicSystems.length, 0)
    const landscapePage = settings.orientation === 'landscape'
    const pageHeightPt = landscapePage ? A4_PT.short : A4_PT.long
    const aspect = landscapePage ? A4_PT.short / A4_PT.long : A4_PT.long / A4_PT.short
    // 고른 크기로 그렸을 때 쪽 아래가 잘리거나 4마디가 한 줄을 넘으면, 들어갈 때까지 작게 다시 그린다
    fitZoom(SIZE_ZOOM[settings.size], (zoom) => {
      osmd.zoom = zoom
      // 줄을 쪽에 나눠 담을 때부터 위·아래 여백을 남긴다 (OSMD의 단위는 10px이라 크기에 따라 달라진다)
      const pageUnits = (container.clientWidth / (10 * zoom)) * aspect
      rules.PageTopMargin = (TOP_MARGIN_PT.next / pageHeightPt) * pageUnits
      rules.PageBottomMargin = BOTTOM_MARGIN * pageUnits
      osmd.render()
      return Math.max(pageFill(drawn(), TOP_MARGIN_PT.next / pageHeightPt), lines() > wanted ? OVERFLOW_FILL : 0)
    })
    const pages = drawn()
    if (!pages.length) throw new UserError(t.errors.pdfNoPages)

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: settings.orientation })
    const font = await loadOutlineFont()

    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < pages.length; i++) {
      const svg = pages[i]
      // 긴 곡 제목은 쪽 폭에 맞춰 여러 줄로 나눈다 (한글이 있으면 실제로 그릴 윤곽선 글꼴로 폭을 잰다)
      wrapTitle(svg, (text, px) => (NEEDS_CJK.test(text) ? textWidth(font, text, px) : undefined))
      for (const t of Array.from(svg.querySelectorAll<SVGTextElement>('text'))) {
        normalizeText(t)
        if (NEEDS_CJK.test(t.textContent ?? '')) textToOutline(t, font)
      }
      const vb = svg.viewBox.baseVal
      const w = vb && vb.width ? vb.width : svg.getBoundingClientRect().width
      const h = vb && vb.height ? vb.height : svg.getBoundingClientRect().height
      const scale = Math.min(pageW / w, pageH / h)
      if (i > 0) pdf.addPage()
      // 그림이 시작하는 곳이 쪽마다 같은 위 여백에 오도록 내려 놓는다
      const y = TOP_MARGIN_PT[i === 0 ? 'first' : 'next'] - pageBounds(svg).top * h * scale
      // 쪽보다 좁아지면(긴 제목을 여러 줄로 나눠 악보가 길어진 경우 등) 왼쪽에 붙지 않고 가로 가운데에 놓는다
      await svg2pdf(svg, pdf, { x: (pageW - w * scale) / 2, y, width: w * scale, height: h * scale })

      if (i > 0) await drawRunningTitle(pdf, font, workTitle(xml))

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(90)
      pdf.text(`${i + 1} / ${pages.length}`, pageW / 2, pageH - 16, { align: 'center' })
    }
    return pdf.output('blob')
  } finally {
    osmd.clear()
    container.remove()
  }
}
