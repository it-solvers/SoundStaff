import { jsPDF } from 'jspdf'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { svg2pdf } from 'svg2pdf.js'
import { t } from '../text/ko'
import { UserError } from '../utils/errors'
import { DEFAULT_PDF_SETTINGS, SIZE_ZOOM, type PdfSettings } from './pdfSettings'

const FONT_NAME = 'SoundStaffKR'
const FONT_FILE = 'SoundStaffKR-Regular.ttf'
/** 기본 글꼴(Latin-1)로 그릴 수 없는 글자(한글 등)가 들어 있는지 */
const NEEDS_CJK = /[Ā-￿]/

async function loadFontBase64(): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${FONT_FILE}`)
  if (!res.ok) throw new UserError(t.errors.pdfFont)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
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
 * - 한글이 들어간 글자(곡 제목, 트랙 이름)는 내장한 한글 글꼴로 그린다.
 * - 모든 처리는 브라우저 안에서 하며 서버로 보내지 않는다.
 */
export async function exportScorePdf(xml: string, settings: PdfSettings = DEFAULT_PDF_SETTINGS): Promise<Blob> {
  const landscape = settings.orientation === 'landscape'
  const container = document.createElement('div')
  container.style.cssText = `position:fixed;left:-20000px;top:0;width:${landscape ? 1200 : 900}px;background:#fff`
  document.body.appendChild(container)
  const osmd = new OpenSheetMusicDisplay(container, {
    autoResize: false,
    drawTitle: true,
    autoBeam: true,
    pageFormat: landscape ? 'A4 L' : 'A4 P',
    pageBackgroundColor: '#FFFFFF',
  })
  try {
    await osmd.load(xml)
    osmd.zoom = SIZE_ZOOM[settings.size]
    osmd.render()
    const pages = Array.from(container.querySelectorAll<SVGSVGElement>(':scope > div > svg, :scope > svg'))
    if (!pages.length) throw new UserError(t.errors.pdfNoPages)

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: settings.orientation })
    pdf.addFileToVFS(FONT_FILE, await loadFontBase64())
    pdf.addFont(FONT_FILE, FONT_NAME, 'normal')

    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < pages.length; i++) {
      const svg = pages[i]
      for (const t of Array.from(svg.querySelectorAll<SVGTextElement>('text'))) {
        normalizeText(t)
        if (NEEDS_CJK.test(t.textContent ?? '')) {
          t.setAttribute('font-family', FONT_NAME)
          t.style.fontFamily = FONT_NAME
        }
      }
      const vb = svg.viewBox.baseVal
      const w = vb && vb.width ? vb.width : svg.getBoundingClientRect().width
      const h = vb && vb.height ? vb.height : svg.getBoundingClientRect().height
      const scale = Math.min(pageW / w, pageH / h)
      if (i > 0) pdf.addPage()
      await svg2pdf(svg, pdf, { x: 0, y: 0, width: w * scale, height: h * scale })

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
