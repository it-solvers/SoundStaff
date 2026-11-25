export type PdfOrientation = 'portrait' | 'landscape'
export type PdfSize = 'small' | 'normal' | 'large'
/** 마디 배치: 한 쪽에 4마디 / 자동(들어가는 만큼) */
export type PdfLayout = 'four' | 'auto'
export const MEASURES_PER_PAGE = 4

/** 기획서 8.6장: A4 세로(기본)·가로, 악보 크기 작게/보통/크게 */
export interface PdfSettings {
  orientation: PdfOrientation
  size: PdfSize
  layout: PdfLayout
}

export const DEFAULT_PDF_SETTINGS: PdfSettings = { orientation: 'portrait', size: 'normal', layout: 'four' }

/** 악보 크기별 확대 비율 (정확한 값은 시험하며 정한다 — 기획서 8.6장) */
export const SIZE_ZOOM: Record<PdfSize, number> = { small: 0.75, normal: 1, large: 1.3 }
