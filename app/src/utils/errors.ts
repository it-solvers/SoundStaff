import { t } from '../text/ko'

/**
 * 오류를 처리한다. 상세 내용은 콘솔에만 남기고(기획서 11.3장) 파일 내용은 어디로도 보내지 않는다.
 * 화면에는 우리가 직접 만든 안내 문구만 보여 주고, 예상 못 한 오류는 일반 안내 문구로 바꾼다.
 */
export class UserError extends Error {}

export function reportError(e: unknown): string {
  console.error(e)
  return e instanceof UserError ? e.message : t.errors.unexpected
}

/** 앱에 꼭 필요한 브라우저 기능이 있는지 확인한다 (없으면 안내 문구를 돌려준다) */
export function checkBrowserSupport(): string | null {
  const ok =
    typeof File !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function' &&
    typeof TextDecoder !== 'undefined' &&
    typeof Promise !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof document.createElementNS === 'function'
  return ok ? null : t.errors.unsupportedBrowser
}
