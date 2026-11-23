/** 확장자를 뗀 파일 이름 */
export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

/** 파일 이름으로 쓸 수 없는 문자를 바꾼다 */
export function safeFileName(name: string): string {
  const cleaned = Array.from(name, (c) => (c.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(c) ? '_' : c)).join('')
  return cleaned.trim() || 'score'
}

/** 같은 이름이 있으면 "이름 (1).확장자"처럼 번호를 붙여 겹치지 않게 한다 */
export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let n = 1; ; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
  }
}
