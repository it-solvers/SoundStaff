import { en } from './en'
import { ko, type Messages } from './ko'

/** 페이지(index.html, en/index.html)의 <html lang>으로 언어를 정한다. 시험처럼 문서가 없으면 한국어다. */
export const isEnglish = typeof document !== 'undefined' && document.documentElement?.lang === 'en'

/** 지금 쓰는 문구 */
export const t: Messages = isEnglish ? en : ko
