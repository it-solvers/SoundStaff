import type { AudioNote } from '../midi/types'

/** 기획서 8.5장 3번: 너무 짧거나 신뢰도가 낮은 음표는 지운다. 값은 시험하며 조정한다. */
export const MIN_NOTE_SECONDS = 0.08
export const MIN_CONFIDENCE = 0.25

/** 거르고 시작 순서로 정렬한다. 같은 시작이면 높은 음이 먼저 온다. */
export function filterNotes(raw: AudioNote[]): AudioNote[] {
  return raw
    .filter((n) => n.durationSec >= MIN_NOTE_SECONDS && n.velocity >= MIN_CONFIDENCE)
    .sort((a, b) => a.startSec - b.startSec || b.midi - a.midi)
}
