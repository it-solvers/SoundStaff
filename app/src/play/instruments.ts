/**
 * [악기별 소리]: MIDI의 악기 번호(GM 0~127)를 비슷한 계열의 소리로 연결한다.
 * 어쿠스틱 피아노는 녹음 샘플을, 나머지는 합성음을 쓴다. 진짜 악기 소리가 아니라 계열을 구별해 듣는 것이 목표다.
 */
import { TIMBRES, type Timbre } from './synth'

const nylonGuitar: Timbre = {
  harmonics: [0, 1, 0.6, 0.45, 0.2, 0.12, 0.08, 0.04],
  attack: 0.004,
  level: 0.5,
  sustain: 0.08,
  decay: (midi) => 0.25 + Math.max(0, 84 - midi) / 90,
  release: 0.08,
}

/** 합성음 설계표. 선택칸의 합성음과 같은 것은 그대로 쓰고, 계열마다 필요한 것을 더한다 */
export const INSTRUMENT_TIMBRES = {
  organ: TIMBRES.organ,
  strings: TIMBRES.strings,
  flute: TIMBRES.flute,
  bell: TIMBRES.bell,
  harpsichord: TIMBRES.harpsichord,
  /** 실제 피아노를 불러오지 못했을 때의 대신 소리 */
  piano: TIMBRES.piano,
  electricPiano: {
    harmonics: [0, 1, 0.12, 0.05, 0.22, 0.02, 0.03],
    attack: 0.005,
    level: 0.45,
    sustain: 0.2,
    decay: (midi) => 0.4 + Math.max(0, 96 - midi) / 90,
    release: 0.15,
  },
  mallet: {
    harmonics: [0, 1, 0.05, 0.02, 0.35],
    attack: 0.002,
    level: 0.5,
    sustain: 0.02,
    decay: () => 0.2,
    release: 0.15,
  },
  nylonGuitar,
  electricGuitar: {
    ...nylonGuitar,
    harmonics: [0, 1, 0.7, 0.55, 0.45, 0.3, 0.2, 0.14, 0.09],
    level: 0.38,
    sustain: 0.2,
  },
  distortionGuitar: {
    harmonics: [0, 1, 0.8, 0.9, 0.6, 0.7, 0.45, 0.5, 0.3, 0.35, 0.2],
    attack: 0.008,
    level: 0.26,
    sustain: 0.8,
    decay: () => 0.8,
    release: 0.1,
  },
  bass: {
    harmonics: [0, 1, 0.7, 0.35, 0.18, 0.08, 0.04],
    attack: 0.008,
    level: 0.65,
    sustain: 0.35,
    decay: () => 0.35,
    release: 0.07,
  },
  /** 현을 뜯는 소리: 하프, 피치카토, 민속 현악기 */
  plucked: { ...nylonGuitar, harmonics: [0, 1, 0.35, 0.2, 0.08, 0.04], sustain: 0.03 },
  /** 독주 현악기: 합주보다 빨리 시작하고 떨림이 뚜렷하다 */
  bowed: {
    harmonics: [0, 1, 0.6, 0.45, 0.35, 0.25, 0.2, 0.14, 0.1],
    attack: 0.08,
    level: 0.34,
    sustain: 0.85,
    decay: () => 0.5,
    release: 0.14,
    vibrato: { rate: 5.8, depth: 14, delay: 0.2 },
  },
  choir: {
    harmonics: [0, 1, 0.45, 0.12, 0.2, 0.05],
    attack: 0.18,
    level: 0.34,
    sustain: 0.9,
    decay: () => 0.6,
    release: 0.25,
    vibrato: { rate: 5, depth: 9, delay: 0.3 },
    ensemble: 10,
  },
  brass: {
    harmonics: [0, 1, 0.8, 0.65, 0.5, 0.35, 0.22, 0.12, 0.06],
    attack: 0.05,
    level: 0.3,
    sustain: 0.75,
    decay: () => 0.25,
    release: 0.09,
  },
  /** 겹리드·색소폰: 코맹맹이 소리 (높은 배음이 강하다) */
  reed: {
    harmonics: [0, 0.6, 0.75, 1, 0.6, 0.35, 0.25, 0.15, 0.08],
    attack: 0.035,
    level: 0.24,
    sustain: 0.9,
    decay: () => 0.4,
    release: 0.08,
    vibrato: { rate: 5.2, depth: 7, delay: 0.3 },
  },
  /** 클라리넷: 홀수 배음 위주 */
  clarinet: {
    harmonics: [0, 1, 0.04, 0.5, 0.04, 0.28, 0.03, 0.14],
    attack: 0.04,
    level: 0.28,
    sustain: 0.9,
    decay: () => 0.4,
    release: 0.08,
  },
  synthLead: {
    harmonics: [0, 1, 0.5, 0.33, 0.25, 0.2, 0.17, 0.14, 0.12],
    attack: 0.01,
    level: 0.24,
    sustain: 0.8,
    decay: () => 0.3,
    release: 0.08,
  },
  synthPad: {
    harmonics: [0, 1, 0.3, 0.18, 0.08, 0.05],
    attack: 0.35,
    level: 0.28,
    sustain: 0.9,
    decay: () => 0.8,
    release: 0.45,
    ensemble: 12,
  },
  timpani: {
    harmonics: [0, 1, 0.5, 0.2, 0.08],
    attack: 0.004,
    level: 0.65,
    sustain: 0.05,
    decay: () => 0.35,
    release: 0.2,
  },
} satisfies Record<string, Timbre>

export type InstrumentSound = 'grandPiano' | keyof typeof INSTRUMENT_TIMBRES

/** [여기까지의 번호, 소리] — 앞에서부터 처음 맞는 줄을 쓴다 */
const RANGES: [last: number, sound: InstrumentSound][] = [
  [3, 'grandPiano'],
  [5, 'electricPiano'],
  [7, 'harpsichord'],
  [10, 'bell'], // 첼레스타, 글로켄슈필, 뮤직 박스
  [13, 'mallet'], // 비브라폰, 마림바, 실로폰
  [14, 'bell'], // 튜불러 벨
  [15, 'plucked'], // 덜시머
  [20, 'organ'],
  [23, 'reed'], // 아코디언, 하모니카
  [25, 'nylonGuitar'],
  [28, 'electricGuitar'],
  [30, 'distortionGuitar'],
  [31, 'bell'], // 기타 하모닉스
  [39, 'bass'],
  [44, 'bowed'],
  [46, 'plucked'], // 피치카토, 하프
  [47, 'timpani'],
  [51, 'strings'],
  [54, 'choir'],
  [63, 'brass'],
  [70, 'reed'], // 색소폰, 오보에, 바순
  [71, 'clarinet'],
  [79, 'flute'],
  [87, 'synthLead'],
  [97, 'synthPad'],
  [98, 'bell'], // FX 크리스털
  [103, 'synthPad'],
  [107, 'plucked'], // 시타르, 밴조 등
  [108, 'mallet'], // 칼림바
  [109, 'reed'], // 백파이프
  [110, 'bowed'], // 피들
  [111, 'reed'], // 셰나이
  [119, 'mallet'], // 타악기 계열 음색
  [127, 'synthPad'], // 효과음
]

export const instrumentSound = (program: number): InstrumentSound =>
  RANGES.find(([last]) => program <= last)?.[1] ?? 'grandPiano'
