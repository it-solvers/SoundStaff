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

/**
 * 같은 높이의 음이 이 시간(초) 이내로 이어지면 한 음으로 본다.
 * 기획서 8.5장의 레가토 병합은 50ms지만, 떨림(트레몰로·비브라토)으로 소리 크기가 출렁이면 AI가 50~100ms 틈으로 끊어 내는 조각이 더 있어서(시험곡 21개) 100ms로 넓혔다.
 */
export const MERGE_GAP_SECONDS = 0.1

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

/** 덜 주된 음으로 볼 비율: 중요도가 아래쪽 이 비율인 음 (작고 짧은 음) */
export const MINOR_SHARE = 0.4

/** 음의 중요도: 소리가 크고(세기) 오래 이어질수록(길이) 크다 */
export const importance = (n: AudioNote) => n.velocity * Math.sqrt(n.durationSec)

/**
 * 소리가 작고 짧은 음을 "덜 주된 음"(minor)으로 표시한다 (악보에서 회색으로 그려 주된 음이 돋보이게 한다).
 * 음은 하나도 지우지 않고 표시만 한다. 중요도(세기 × √길이)가 낮은 쪽 share(기본 40%) 개수만큼이 대상이다.
 * 음이 너무 적으면(5개 미만) 표시하지 않는다.
 */
export function markMinorNotes(notes: AudioNote[], share = MINOR_SHARE): AudioNote[] {
  if (notes.length < 5) return notes.map((n) => ({ ...n, minor: false }))
  // 중요도가 낮은 순서로 줄 세워 앞에서 round(전체 × share)개를 덜 주된 음으로 한다 (비율과 개수가 정확히 맞는다)
  const order = notes.map((n, i) => ({ i, v: importance(n) })).sort((a, b) => a.v - b.v || a.i - b.i)
  const k = Math.round(notes.length * share)
  const minor = new Set(order.slice(0, k).map((o) => o.i))
  return notes.map((n, i) => ({ ...n, minor: minor.has(i) }))
}
