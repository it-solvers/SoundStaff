import type { AudioNote } from '../midi/types'

/**
 * 주 멜로디 선택 (기획서 8.5장 4번, 4단계 필터링).
 * 음원 분석은 곡의 주 멜로디 한 줄만 악보로 만든다. 화음·반주는 작곡가가 편곡으로 채운다.
 *
 *  1단계(음역 필터): 사람 목소리·주선율 음역 C3~G5(MIDI 48~79) 밖의 음(심벌즈·효과음, 베이스·킥)은 제외한다.
 *  2단계(신뢰도·길이 우선): 같은 시간에 여러 음이 있으면 `신뢰도 × 음 지속시간` 점수가 가장 높은 음을 고른다.
 *  3단계(옥타브 점프 보정): 직전 음보다 1옥타브(12반음) 이상 튄 짧은 음은 배음 오인식으로 보고 직전 음 가까운 옥타브로 맞춘다.
 *  4단계(레가토 병합): 같은 높이가 50ms 이내의 짧은 틈으로 이어지면 하나의 긴 음표로 합친다.
 * 그 밖에 너무 짧은 조각은 이웃에 합치고, 결과는 항상 한 번에 한 음만 있는 한 줄 선율이다 (겹치는 음 없음).
 * 기준값은 시험곡으로 조정한다.
 */
export const MELODY_LOW = 48 // C3
export const MELODY_HIGH = 79 // G5
export const MIN_SEGMENT_SECONDS = 0.08
/** 4단계: 같은 높이를 이어 붙이는 최대 틈 (50ms) */
export const LEGATO_GAP_SECONDS = 0.05
/** 이보다 짧은 음만 "튄 음"으로 보고 옥타브를 맞춘다 (긴 음은 진짜 멜로디로 본다) */
export const OUTLIER_MAX_SECONDS = 0.8
/** 앞뒤 음과 이 반음 수 이상 떨어져 있으면 "튄 음" 후보 */
const JUMP = 10
/** 앞뒤 음끼리는 이 반음 수 이내여야 한다 (그래야 중간 음만 튄 것이다) */
const NEIGHBOR_CLOSE = 5

interface Segment {
  start: number
  end: number
  midi: number
  velocity: number
}

const score = (n: AudioNote) => n.velocity * n.durationSec

/** 활성 음 중 `신뢰도 × 음 지속시간` 점수가 가장 높은 음을 시간 구간마다 고른다 (음역 필터는 먼저 적용) */
function followBest(notes: AudioNote[]): Segment[] {
  const candidates = notes.filter((n) => n.midi >= MELODY_LOW && n.midi <= MELODY_HIGH)
  if (!candidates.length) return []
  const times = [...new Set(candidates.flatMap((n) => [n.startSec, n.startSec + n.durationSec]))].sort((a, b) => a - b)
  const segs: Segment[] = []
  for (let i = 0; i + 1 < times.length; i++) {
    const a = times[i]
    const b = times[i + 1]
    if (b - a < 1e-6) continue
    const mid = (a + b) / 2
    let top: AudioNote | null = null
    for (const n of candidates) {
      if (n.startSec <= mid && mid < n.startSec + n.durationSec && (!top || score(n) > score(top))) top = n
    }
    if (!top) continue
    const last = segs[segs.length - 1]
    if (last && last.midi === top.midi && Math.abs(last.end - a) < 1e-6) {
      last.end = b
      last.velocity = Math.max(last.velocity, top.velocity)
    } else segs.push({ start: a, end: b, midi: top.midi, velocity: top.velocity })
  }
  return segs
}

/** 같은 높이가 틈 없이(또는 아주 작은 틈으로) 이어지면 하나로 합친다 */
function mergeSame(segs: Segment[], gap = LEGATO_GAP_SECONDS): Segment[] {
  const out: Segment[] = []
  for (const s of segs) {
    const last = out[out.length - 1]
    if (last && last.midi === s.midi && s.start - last.end <= gap) {
      last.end = s.end
      last.velocity = Math.max(last.velocity, s.velocity)
    } else out.push({ ...s })
  }
  return out
}

/** 너무 짧은 조각은 지운다. 바로 앞 음이 이어지는 자리(틈 없음)면 앞 음을 그만큼 늘린다. */
function dropTiny(segs: Segment[]): Segment[] {
  const out: Segment[] = []
  for (const s of segs) {
    if (s.end - s.start >= MIN_SEGMENT_SECONDS) out.push({ ...s })
    else {
      const last = out[out.length - 1]
      if (last && Math.abs(s.start - last.end) < 1e-6) last.end = s.end
    }
  }
  return out
}

/** 앞뒤 음과 크게 떨어진 짧은 음을 앞뒤와 이어지는 옥타브로 맞추고, 맞출 수 없으면 지운다 */
function smoothOutliers(segs: Segment[]): Segment[] {
  const out = segs.map((s) => ({ ...s }))
  for (let i = 1; i + 1 < out.length; i++) {
    const prev = out[i - 1]
    const cur = out[i]
    const next = out[i + 1]
    const short = cur.end - cur.start < OUTLIER_MAX_SECONDS
    const farFromBoth = Math.abs(cur.midi - prev.midi) >= JUMP && Math.abs(cur.midi - next.midi) >= JUMP
    if (!short || !farFromBoth || Math.abs(prev.midi - next.midi) > NEIGHBOR_CLOSE) continue
    const folded = cur.midi - 12 * Math.round((cur.midi - prev.midi) / 12)
    if (Math.abs(folded - prev.midi) <= NEIGHBOR_CLOSE && folded >= MELODY_LOW && folded <= MELODY_HIGH)
      cur.midi = folded
    else {
      cur.velocity = -1 // 표시해 두었다가 아래에서 지운다
      if (Math.abs(cur.start - prev.end) < 1e-6) prev.end = cur.end // 앞 음이 그 자리를 이어받아 선율이 끊기지 않게 한다
    }
  }
  return out.filter((s) => s.velocity >= 0)
}

/**
 * 3단계: 직전 음보다 1옥타브 이상 튄 짧은 음을 직전 음 가까운 옥타브로 맞춘다.
 * 튄 뒤에도 그 높이에 머무는 진짜 도약은 건드리지 않는다 (다음 음이 튄 음을 따라가면 도약으로 본다).
 * 비교는 보정 전 값으로 해서, 보정이 뒤 음들로 번지지 않게 한다.
 */
function foldOctaveJumps(segs: Segment[]): Segment[] {
  const out = segs.map((s) => ({ ...s }))
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1]
    const cur = segs[i]
    const next = segs[i + 1]
    if (cur.end - cur.start >= OUTLIER_MAX_SECONDS || Math.abs(cur.midi - prev.midi) < 12) continue
    if (next && Math.abs(next.midi - cur.midi) <= NEIGHBOR_CLOSE) continue
    const folded = cur.midi - 12 * Math.round((cur.midi - prev.midi) / 12)
    if (folded >= MELODY_LOW && folded <= MELODY_HIGH) out[i].midi = folded
  }
  return out
}

/**
 * 여러 음이 섞인 분석 결과에서 주 멜로디 한 줄을 뽑는다.
 * 돌려주는 음표는 시작 순서이며 서로 겹치지 않는다.
 */
export function selectMelody(notes: AudioNote[]): AudioNote[] {
  let segs = followBest(notes)
  segs = dropTiny(mergeSame(segs))
  segs = foldOctaveJumps(smoothOutliers(segs))
  segs = dropTiny(mergeSame(segs))
  return segs.map((s) => ({ startSec: s.start, durationSec: s.end - s.start, midi: s.midi, velocity: s.velocity }))
}

/** 이 개수보다 적으면 멜로디를 찾지 못한 것으로 본다 (기획서 11.3장) */
export const MIN_MELODY_NOTES = 3
