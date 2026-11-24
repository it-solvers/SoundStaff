import { rng, type RNote, type Timbre } from './synth'

/** 유형별 시험곡. 같은 값(난수 씨앗)이면 늘 같은 곡이 나온다. */
export interface Piece {
  /** 곡 유형 이름 (결과 표에 그대로 나온다) */
  name: string
  /** 같은 계열끼리 묶는 이름 */
  group: string
  /** 정답 템포 */
  bpm: number
  notes: RNote[]
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
/** 계이름 위치(0=도, 7=한 옥타브 위 도)를 MIDI 음 번호로 */
const degree = (d: number, tonic = 60) => tonic + 12 * Math.floor(d / 7) + MAJOR[((d % 7) + 7) % 7]

type Shape = { beats: number; weight: number }

/** 한 줄 선율: 계이름을 걷듯이 오르내린다 */
function melody(opts: {
  seed: number
  bpm: number
  bars: number
  shapes: Shape[]
  lo: number
  hi: number
  timbre: Timbre
  start?: number
  rest?: number
  vel?: number
}): RNote[] {
  const r = rng(opts.seed)
  const beat = 60 / opts.bpm
  const total = Math.floor(opts.bars * 4)
  const out: RNote[] = []
  let deg = Math.round(((opts.lo + opts.hi) / 2 / 12) * 7 - 35)
  let t = 0
  const sum = opts.shapes.reduce((a, s) => a + s.weight, 0)
  while (t < total - 0.001) {
    let x = r() * sum
    let sh = opts.shapes[0]
    for (const s of opts.shapes) {
      if ((x -= s.weight) <= 0) {
        sh = s
        break
      }
    }
    const beats = Math.min(sh.beats, total - t)
    const step = [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)]
    deg += step
    while (degree(deg) < opts.lo) deg += 1
    while (degree(deg) > opts.hi) deg -= 1
    if (!(opts.rest && r() < opts.rest)) {
      out.push({
        midi: degree(deg),
        start: (opts.start ?? 0) + t * beat,
        dur: beats * beat * 0.95,
        vel: opts.vel ?? 0.8,
        timbre: opts.timbre,
      })
    }
    t += beats
  }
  return out
}

const PROG = [
  [0, 4, 7], // I
  [9, 12, 16], // vi
  [5, 9, 12], // IV
  [7, 11, 14], // V
]

/** 왼손 반주: 마디마다 코드 하나를 아르페지오(분산 화음)나 블록 화음으로 친다 */
function accompaniment(bars: number, bpm: number, mode: 'arp' | 'block', timbre: Timbre, root = 48): RNote[] {
  const beat = 60 / bpm
  const out: RNote[] = []
  for (let b = 0; b < bars; b++) {
    const chord = PROG[b % 4].map((x) => root + (x >= 9 ? x - 12 : x))
    if (mode === 'block') {
      for (const m of chord) out.push({ midi: m, start: b * 4 * beat, dur: 3.8 * beat, vel: 0.65, timbre })
    } else {
      const pat = [0, 1, 2, 1, 0, 1, 2, 1]
      pat.forEach((k, i) =>
        out.push({ midi: chord[k], start: (b * 4 + i * 0.5) * beat, dur: 0.5 * beat * 0.95, vel: 0.6, timbre }),
      )
    }
  }
  return out
}

/** 4성부 합창풍: 박마다 코드가 바뀌고 각 성부는 가까운 음으로 움직인다 */
function choir(bars: number, bpm: number, timbre: Timbre, seed: number): RNote[] {
  const r = rng(seed)
  const beat = 60 / bpm
  const ranges: [number, number][] = [
    [64, 79], // 소프라노
    [55, 69], // 알토
    [48, 62], // 테너
    [40, 55], // 베이스
  ]
  const out: RNote[] = []
  const prev = [72, 64, 55, 48]
  for (let b = 0; b < bars * 2; b++) {
    const chordPcs = PROG[Math.floor(b / 2) % 4].map((x) => (x + 60) % 12)
    const dur = 2 * beat
    for (let v = 0; v < 4; v++) {
      let best = prev[v]
      let bestD = 99
      for (let m = ranges[v][0]; m <= ranges[v][1]; m++) {
        if (!chordPcs.includes(m % 12)) continue
        if (v === 3 && m % 12 !== chordPcs[0]) continue
        const d = Math.abs(m - prev[v]) + r() * 1.5
        if (d < bestD) {
          bestD = d
          best = m
        }
      }
      prev[v] = best
      out.push({ midi: best, start: b * 2 * beat, dur: dur * 0.95, vel: 0.7, timbre })
    }
  }
  return out
}

/** 사람 연주처럼 시작·길이·세기를 조금씩 흔든다 (시작 ±35ms, 길이 ±10%) */
function humanize(notes: RNote[], seed: number): RNote[] {
  const r = rng(seed)
  return notes.map((n) => ({
    ...n,
    start: Math.max(0, n.start + (r() - 0.5) * 0.07),
    dur: n.dur * (0.9 + r() * 0.2),
    vel: Math.min(1, Math.max(0.3, n.vel + (r() - 0.5) * 0.3)),
  }))
}

const SLOW: Shape[] = [
  { beats: 1, weight: 5 },
  { beats: 2, weight: 3 },
  { beats: 0.5, weight: 2 },
]
const FAST: Shape[] = [
  { beats: 0.25, weight: 5 },
  { beats: 0.5, weight: 4 },
  { beats: 1, weight: 1 },
]
const LONG: Shape[] = [
  { beats: 2, weight: 4 },
  { beats: 4, weight: 2 },
  { beats: 1, weight: 2 },
]

export function buildPieces(): Piece[] {
  const slowPiano = melody({ seed: 11, bpm: 80, bars: 12, shapes: SLOW, lo: 60, hi: 79, timbre: 'piano' })
  const rightHand = melody({ seed: 21, bpm: 90, bars: 12, shapes: SLOW, lo: 64, hi: 81, timbre: 'piano', vel: 0.85 })
  const stringsLine = melody({ seed: 31, bpm: 70, bars: 10, shapes: LONG, lo: 60, hi: 79, timbre: 'strings', vel: 0.9 })
  const ensembleLead = melody({
    seed: 41,
    bpm: 90,
    bars: 12,
    shapes: SLOW,
    lo: 67,
    hi: 84,
    timbre: 'strings',
    vel: 0.95,
  })
  return [
    { name: '피아노 단선율 · 느림 (80BPM)', group: '피아노 한 줄', bpm: 80, notes: slowPiano },
    {
      name: '피아노 단선율 · 빠름 (140BPM, 16분음표)',
      group: '피아노 한 줄',
      bpm: 140,
      notes: melody({ seed: 12, bpm: 140, bars: 12, shapes: FAST, lo: 60, hi: 79, timbre: 'piano' }),
    },
    {
      name: '피아노 단선율 · 높은 음역 (C6~C7)',
      group: '피아노 한 줄',
      bpm: 80,
      notes: melody({ seed: 13, bpm: 80, bars: 12, shapes: SLOW, lo: 84, hi: 96, timbre: 'piano' }),
    },
    {
      name: '피아노 단선율 · 낮은 음역 (C2~C3)',
      group: '피아노 한 줄',
      bpm: 80,
      notes: melody({ seed: 14, bpm: 80, bars: 12, shapes: SLOW, lo: 36, hi: 50, timbre: 'piano' }),
    },
    {
      name: '피아노 단선율 · 쉼표 많음',
      group: '피아노 한 줄',
      bpm: 90,
      notes: melody({ seed: 15, bpm: 90, bars: 12, shapes: SLOW, lo: 60, hi: 79, timbre: 'piano', rest: 0.35 }),
    },
    {
      name: '피아노 양손 · 멜로디 + 아르페지오',
      group: '피아노 여러 음',
      bpm: 90,
      notes: [...rightHand, ...accompaniment(12, 90, 'arp', 'piano')],
    },
    {
      name: '피아노 양손 · 멜로디 + 블록 화음',
      group: '피아노 여러 음',
      bpm: 90,
      notes: [...rightHand, ...accompaniment(12, 90, 'block', 'piano')],
    },
    { name: '피아노 4성부 화음 (합창풍)', group: '피아노 여러 음', bpm: 80, notes: choir(10, 80, 'piano', 51) },
    {
      name: '피아노 양손 · 사람 연주 흔들림',
      group: '피아노 여러 음',
      bpm: 90,
      notes: humanize([...rightHand, ...accompaniment(12, 90, 'arp', 'piano')], 61),
    },
    { name: '현악(합성) 단선율 · 길게 이어짐', group: '악기 소리 달라짐', bpm: 70, notes: stringsLine },
    { name: '현악(합성) 4성부 화음', group: '악기 소리 달라짐', bpm: 80, notes: choir(10, 80, 'strings', 71) },
    {
      name: '현악 멜로디 + 피아노 반주',
      group: '악기 소리 달라짐',
      bpm: 90,
      notes: [...ensembleLead, ...accompaniment(12, 90, 'arp', 'piano')],
    },
    {
      name: '현악 멜로디 + 피아노 반주 + 플루트 대선율',
      group: '악기 소리 달라짐',
      bpm: 90,
      notes: [
        ...ensembleLead,
        ...accompaniment(12, 90, 'arp', 'piano'),
        ...melody({ seed: 81, bpm: 90, bars: 12, shapes: LONG, lo: 79, hi: 91, timbre: 'flute', vel: 0.7 }),
      ],
    },
  ]
}
