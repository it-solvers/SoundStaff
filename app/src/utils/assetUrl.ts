/**
 * public 폴더 파일의 주소. 빌드 결과는 상대 경로라서, 하위 폴더에 있는 페이지(en/)는
 * <html data-root="../">로 앱 최상위 폴더 위치를 알려 준다.
 */
export function assetUrl(path: string): string {
  const root = typeof document === 'undefined' ? '' : (document.documentElement?.dataset.root ?? '')
  return `${import.meta.env.BASE_URL}${root}${path}`
}
