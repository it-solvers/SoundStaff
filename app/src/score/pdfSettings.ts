export type PdfOrientation = 'portrait' | 'landscape'
export type PdfSize = 'small' | 'normal' | 'large'

/** 기획서 8.6장: A4 세로(기본)·가로, 악보 크기 작게/보통/크게 */
export interface PdfSettings {
  orientation: PdfOrientation
  size: PdfSize
}

export const DEFAULT_PDF_SETTINGS: PdfSettings = { orientation: 'portrait', size: 'normal' }

/** 악보 크기별 확대 비율 (정확한 값은 시험하며 정한다 — 기획서 8.6장) */
export const SIZE_ZOOM: Record<PdfSize, number> = { small: 0.75, normal: 1, large: 1.3 }
