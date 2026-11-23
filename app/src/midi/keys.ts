/** 조표 수(fifths, 플랫 음수·샵 양수) → 으뜸음 이름. 인덱스는 fifths + 7 */
export const MAJOR_BY_FIFTHS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
/** 같은 조표를 쓰는 나란한 단조의 으뜸음 이름 */
export const MINOR_BY_FIFTHS = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#']

export type KeyMode = 'major' | 'minor'

export function tonicName(fifths: number, mode: KeyMode): string {
  return (mode === 'minor' ? MINOR_BY_FIFTHS : MAJOR_BY_FIFTHS)[fifths + 7] ?? 'C'
}

/** 화면 표시용: 음이름의 b·#를 ♭·♯로 */
export function prettyTonic(name: string): string {
  return name.replace('b', '♭').replace('#', '♯')
}

/** 조표 설명: "♭3개", "♯2개", "♯♭ 없음" */
export function accidentalsLabel(fifths: number): string {
  if (fifths === 0) return '♯♭ 없음'
  return fifths < 0 ? `♭${-fifths}개` : `♯${fifths}개`
}
