/**
 * MIDI의 실제 음높이를 읽기 좋은 악보로 옮기는 규칙: 옥타브 표시 음자리표와 건반악기의 두 보표.
 * 음높이 자체는 바꾸지 않는다 (MusicXML에는 소리 나는 높이를 적고, 보표 위 위치만 옮긴다).
 */
import type { QNote } from '../midi/quantize'

export interface StaffClef {
  clef: 'G' | 'F'
  /** 음자리표에 붙는 옥타브 표시. -1: 한 옥타브 올려 적는다(음자리표 아래 8), 0: 그대로 */
  octave: number
}

/** 가운데 도 */
export const SPLIT_MIDI = 60

const isGuitar = (program: number) => program >= 24 && program <= 31
const isLowStrings = (program: number) => (program >= 32 && program <= 39) || program === 43 // 베이스 기타, 더블베이스
/** 피아노·하프시코드 계열(0~7)과 오르간(16~20) */
const isKeyboard = (program: number) => program <= 7 || (program >= 16 && program <= 20)

/** 여러 사람의 소리를 한 트랙에 담는 악기: 합주 현악·합창(48~54), 신스 패드·효과음(88~103) */
const isEnsemble = (program: number) => (program >= 48 && program <= 54) || (program >= 88 && program <= 103)

/** 음원 분석 악보의 음자리표: 평균 음높이로 정한다 */
export function pickClef(notes: QNote[]): 'G' | 'F' {
  if (!notes.length) return 'G'
  const avg = notes.reduce((a, n) => a + n.midi, 0) / notes.length
  return avg < 54 ? 'F' : 'G'
}

/** 음높이 번호 → 온음 자리 번호 (C=0, D=1 …, 옥타브마다 7). 검은건반은 아래 흰건반 자리로 본다 */
const DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
const diatonic = (midi: number) => Math.floor(midi / 12) * 7 + DIATONIC[midi % 12]

/** 보표의 맨 아랫줄·맨 윗줄 음: 높은음자리표 E4~F5, 낮은음자리표 G2~A3 */
const LINES = { G: [diatonic(64), diatonic(77)], F: [diatonic(43), diatonic(57)] }

/** 이 음자리표에서 이 음에 필요한 덧줄 수 */
export function ledgerLines(midi: number, { clef, octave }: StaffClef): number {
  const at = diatonic(midi) - octave * 7
  const [bottom, top] = LINES[clef]
  return Math.floor(Math.max(0, bottom - at, at - top) / 2)
}

/**
 * 고를 수 있는 음자리표. 위쪽 옥타브 표시(위 8·15)는 화면·PDF를 그리는 라이브러리(OSMD)가 숫자를 빼먹어서 쓰지 않는다:
 * 표시 없이 음만 옮겨 적으면 연주자가 다른 높이로 읽는다.
 */
const CANDIDATES: StaffClef[] = [
  { clef: 'G', octave: 0 },
  { clef: 'F', octave: 0 },
  { clef: 'F', octave: -1 },
]

/** 덧줄이 가장 적은 음자리표. 덧줄이 많을수록 읽기 어려워 제곱으로 세고, 옥타브 표시는 조금 불리하게 본다 */
export function bestClef(notes: QNote[]): StaffClef {
  const cost = (c: StaffClef) => notes.reduce((a, n) => a + ledgerLines(n.midi, c) ** 2 + Math.abs(c.octave) * 0.5, 0)
  return CANDIDATES.reduce((best, c) => (cost(c) < cost(best) ? c : best))
}

export function staffClef(program: number, notes: QNote[]): StaffClef {
  // 기타와 베이스는 관례대로 실제 소리보다 한 옥타브 높게 적는다
  if (isGuitar(program)) return { clef: 'G', octave: -1 }
  if (isLowStrings(program)) return { clef: 'F', octave: -1 }
  return bestClef(notes)
}

/**
 * 아주 높은 악기를 몇 옥타브 낮춰 적고 점선 표시(1: 8va, 2: 15ma)를 붙일지. 0이면 그대로.
 * 보통 높이(가온음이 C6 미만)의 악기에는 쓰지 않는다.
 */
export function ottavaFor(notes: QNote[], c: StaffClef): 0 | 1 | 2 {
  if (c.clef !== 'G' || c.octave !== 0 || !notes.length) return 0
  const sorted = notes.map((n) => n.midi).sort((a, b) => a - b)
  if (sorted[Math.floor(sorted.length / 2)] < 84) return 0
  const cost = (k: number) => notes.reduce((a, n) => a + ledgerLines(n.midi - 12 * k, c) ** 2 + k * 0.5, 0)
  return ([0, 1, 2] as const).reduce<0 | 1 | 2>((best, k) => (cost(k) < cost(best) ? k : best), 0)
}

/** 덧줄이 3개 이상 필요한 음의 비율 */
const hardShare = (notes: QNote[], c: StaffClef) =>
  notes.length ? notes.filter((n) => ledgerLines(n.midi, c) >= 3).length / notes.length : 0

/**
 * 두 보표(높은음자리표·낮은음자리표)로 나눌지.
 * 음역이 넓은 건반악기, 그리고 화음을 내는데 한 보표로는 덧줄이 많은 합주 현악·합창·패드. 기타·베이스는 한 보표가 관례다.
 */
export function needsTwoStaves(program: number, notes: QNote[]): boolean {
  if (isGuitar(program) || isLowStrings(program)) return false
  const wide = notes.some((n) => n.midi < 55) && notes.some((n) => n.midi > 64)
  if (!wide) return false
  if (isKeyboard(program)) return true
  if (!isEnsemble(program)) return false
  const chords = new Set(notes.map((n) => n.start)).size < notes.length
  return chords && hardShare(notes, bestClef(notes)) > 0.1
}
