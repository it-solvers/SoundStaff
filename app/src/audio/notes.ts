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

/** 같은 높이의 음이 이 시간(초) 이내로 이어지면 한 음으로 본다 (기획서 8.5장 "레가토 병합" 50ms) */
export const MERGE_GAP_SECONDS = 0.05

/**
 * 같은 높이로 이어지거나 겹친 음을 하나로 합친다.
 * AI는 길게 울리는 한 음을 중간에 새 음으로 계속 끊어 내는 일이 많아서(시험곡은 음의 절반 이상), 그대로 적으면 악보가 잘게 쪼개진다.
 * - 높이마다 시간 순서로 보면서, 다음 음이 앞 음이 끝난 시각에서 maxGap 이내에 시작하면(겹침 포함) 앞 음을 늘려 하나로 만든다.
 * - 합친 음의 세기는 둘 중 센 쪽을 쓴다. 결과는 시작 순서(같은 시작이면 높은 음 먼저)다.
 */
export function mergeRepeatedNotes(notes: AudioNote[], maxGap = MERGE_GAP_SECONDS): AudioNote[] {
  const byPitch = new Map<number, AudioNote[]>()
  for (const n of notes) {
    const list = byPitch.get(n.midi)
    if (list) list.push(n)
    else byPitch.set(n.midi, [n])
  }
  const out: AudioNote[] = []
  for (const list of byPitch.values()) {
    list.sort((a, b) => a.startSec - b.startSec)
    let cur = { ...list[0] }
    for (let i = 1; i < list.length; i++) {
      const n = list[i]
      const curEnd = cur.startSec + cur.durationSec
      if (n.startSec - curEnd <= maxGap) {
        cur.durationSec = Math.max(curEnd, n.startSec + n.durationSec) - cur.startSec
        cur.velocity = Math.max(cur.velocity, n.velocity)
      } else {
        out.push(cur)
        cur = { ...n }
      }
    }
    out.push(cur)
  }
  return out.sort((a, b) => a.startSec - b.startSec || b.midi - a.midi)
}
