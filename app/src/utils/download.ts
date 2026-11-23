/** 브라우저 안에서 Blob을 파일로 저장한다 (서버를 거치지 않음) */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 파일명으로 쓸 수 없는 문자를 바꾼다 */
export function safeFileName(name: string): string {
  const cleaned = Array.from(name, (c) => (c.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(c) ? '_' : c)).join('')
  return cleaned.trim() || 'score'
}
