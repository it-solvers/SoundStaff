import { parse, type Font, type Path } from 'opentype.js'

/**
 * 글자를 글꼴 내장 없이 "선 그림(경로)"으로 바꾼다.
 * PDF에 한글 글꼴을 내장하면 뷰어(미리보기, 브라우저, 인쇄 프로그램)에 따라 한글이 빠져 보이는 일이 있어서,
 * 한글이 든 글자는 윤곽선으로 그려 어떤 뷰어에서도 똑같이 보이게 한다. (대신 그 글자는 PDF에서 복사·검색할 수 없다)
 */
export type OutlineFont = Font
export type TextAnchor = 'start' | 'middle' | 'end'

export function parseOutlineFont(buffer: ArrayBuffer): OutlineFont {
  return parse(buffer)
}

/** 글꼴에 없는 글자는 빈 네모(미지정 글리프)로 그려지지 않도록 뺀다. 공백은 남긴다. */
export function drawableText(font: OutlineFont, text: string): string {
  // 맥 파일 이름처럼 자음·모음이 분리된 한글(NFD)은 글꼴에 없는 글자라 지워지므로, 먼저 합친 형태(NFC)로 바꾼다
  return Array.from(text.normalize('NFC'))
    .filter((c) => c === ' ' || font.charToGlyphIndex(c) > 0)
    .join('')
}

/**
 * 글리프의 선 명령(M, L, Q, C, Z)을 SVG path 문자열로 쓴다.
 * 라이브러리의 toPathData는 특정 위치에서 NaN을 만드는 경우가 있어 직접 쓴다.
 */
function commandsToPathData(path: Path): string {
  const n = (v: number | undefined) => {
    if (v === undefined || !Number.isFinite(v)) throw new Error('글자 윤곽선 좌표가 올바르지 않습니다.')
    return String(Math.round(v * 100) / 100)
  }
  return path.commands
    .map((c) => {
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${n(c.x)} ${n(c.y)}`
        case 'Q':
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`
        case 'C':
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`
        default:
          return 'Z'
      }
    })
    .join('')
}

/**
 * 글자 폭 (글자 사이 간격 보정 없이 글리프 폭을 더한 값).
 * 라이브러리의 글자열 배치 계산(getPath/getAdvanceWidth)은 세 글자 이상에서 NaN이 나오는 경우가 있어
 * (예: "01_") 글자를 하나씩 직접 이어 붙인다. 한글은 글자 사이 간격 보정이 필요 없다.
 */
export function textWidth(font: OutlineFont, text: string, fontSize: number): number {
  const scale = fontSize / font.unitsPerEm
  return Array.from(drawableText(font, text)).reduce((w, c) => w + (font.charToGlyph(c).advanceWidth ?? 0) * scale, 0)
}

/** 글자의 윤곽선 경로 데이터(SVG path의 d 값). y는 글자 바닥선(baseline) 위치다. */
export function textToPathData(
  font: OutlineFont,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  anchor: TextAnchor = 'start',
): string {
  const safe = drawableText(font, text)
  if (!safe.trim()) return ''
  const width = textWidth(font, safe, fontSize)
  let cursor = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
  const scale = fontSize / font.unitsPerEm
  let d = ''
  for (const c of Array.from(safe)) {
    const glyph = font.charToGlyph(c)
    d += commandsToPathData(glyph.getPath(cursor, y, fontSize))
    cursor += (glyph.advanceWidth ?? 0) * scale
  }
  return d
}
