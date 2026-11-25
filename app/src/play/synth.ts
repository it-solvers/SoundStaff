import { scheduleDrum } from './drums'
import type { PlayNote } from './timeline'

export const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** 합성음 6종 */
export type SynthTimbreId = 'piano' | 'organ' | 'strings' | 'flute' | 'bell' | 'harpsichord'
/** 재생 소리: 악기별 소리(MIDI 악기 번호에 따름) + 실제 피아노(녹음 샘플) + 합성음 6종 */
export type TimbreId = 'auto' | 'grandPiano' | SynthTimbreId

/** 합성음 하나의 설계. 외부 음원 파일 없이 배음 구성과 소리 크기 변화로 악기 느낌을 낸다. */
export interface Timbre {
  /** 배음 세기 (0번은 쓰지 않고, 1번이 기본음) */
  harmonics: number[]
  /** 소리가 최대에 이르는 시간(초) */
  attack: number
  /** 최대 세기 (0~1) */
  level: number
  /** 최대 이후 서서히 줄어들어 도달하는 세기 (최대 세기에 대한 비율, 1이면 줄지 않고 계속 울린다) */
  sustain: number
  /** 줄어드는 시간 상수(초). 높은 음일수록 빨리 사라지게 하려면 midi를 받아 계산한다 */
  decay: (midi: number) => number
  /** 음이 끝난 뒤 사라지는 시간 상수(초) */
  release: number
  /** 떨림(비브라토): 주기(Hz), 깊이(센트 = 반음의 1/100), 시작 전 기다리는 시간(초) */
  vibrato?: { rate: number; depth: number; delay: number }
  /** 같은 음을 이 센트만큼 위아래로 어긋나게 두 번 울려 합주 느낌을 낸다 */
  ensemble?: number
}

export const TIMBRES: Record<SynthTimbreId, Timbre> = {
  // 짧게 시작해서 서서히 줄어든다 (높은 음일수록 빨리 사라진다)
  piano: {
    harmonics: [0, 1, 0.55, 0.3, 0.18, 0.1, 0.06, 0.035],
    attack: 0.006,
    level: 0.5,
    sustain: 0.24,
    decay: (midi) => (0.6 + Math.max(0, 96 - midi) / 28) / 2.5,
    release: 0.07,
  },
  // 건반을 누르는 동안 세기가 그대로 이어진다
  organ: {
    harmonics: [0, 1, 0.7, 0.35, 0.5, 0.2, 0.25, 0.1],
    attack: 0.025,
    level: 0.4,
    sustain: 1,
    decay: () => 1,
    release: 0.09,
  },
  // 천천히 시작하고 떨림이 있으며 두 대가 어긋나게 켜는 합주 느낌
  strings: {
    harmonics: [0, 1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.13, 0.11],
    attack: 0.2,
    level: 0.42,
    sustain: 0.85,
    decay: () => 0.6,
    release: 0.28,
    vibrato: { rate: 5.4, depth: 7, delay: 0.25 },
    ensemble: 7,
  },
  // 거의 순수한 소리에 가벼운 떨림
  flute: {
    harmonics: [0, 1, 0.14, 0.05, 0.02],
    attack: 0.07,
    level: 0.25,
    sustain: 0.9,
    decay: () => 0.5,
    release: 0.12,
    vibrato: { rate: 5, depth: 5, delay: 0.3 },
  },
  // 맑게 울리고 길게 사라진다 (음이 끝나도 여운이 남는다)
  bell: {
    harmonics: [0, 1, 0.12, 0.6, 0.06, 0.32, 0.03, 0.16],
    attack: 0.003,
    level: 0.42,
    sustain: 0.04,
    decay: (midi) => 0.5 + Math.max(0, 96 - midi) / 80,
    release: 0.4,
  },
  // 밝고 뾰족하게 시작해서 빨리 줄어든다
  harpsichord: {
    harmonics: [0, 1, 0.9, 0.8, 0.7, 0.55, 0.4, 0.3, 0.2],
    attack: 0.002,
    level: 0.5,
    sustain: 0.12,
    decay: () => 0.18,
    release: 0.05,
  },
}

export const SYNTH_TIMBRE_IDS = Object.keys(TIMBRES) as SynthTimbreId[]
export const TIMBRE_IDS: TimbreId[] = ['auto', 'grandPiano', ...SYNTH_TIMBRE_IDS]
export const DEFAULT_TIMBRE: TimbreId = 'auto'

/** 한 음을 예약한다. 외부 음원 파일 없이 브라우저가 만든 소리만 쓴다 (BaseContext라서 오프라인 렌더로 시험할 수 있다). */
export function scheduleNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  wave: PeriodicWave,
  note: { midi: number; duration: number; velocity?: number },
  when: number,
  timbre: Timbre = TIMBRES.piano,
) {
  const vel = note.velocity ?? 0.8
  const hz = midiToHz(note.midi)
  const end = when + Math.max(0.05, note.duration)
  const stopAt = end + timbre.release * 8 + 0.2

  // 소리 크기 변화: 최대까지 올라간 뒤 지속 세기로 줄어든다
  const env = ctx.createGain()
  const peak = vel * timbre.level
  env.gain.setValueAtTime(0.0001, when)
  env.gain.linearRampToValueAtTime(peak, when + timbre.attack)
  if (timbre.sustain < 1) env.gain.setTargetAtTime(peak * timbre.sustain, when + timbre.attack, timbre.decay(note.midi))

  // 음이 끝나면 부드럽게 끊는다
  const gate = ctx.createGain()
  gate.gain.setValueAtTime(1, when)
  gate.gain.setTargetAtTime(0, end, timbre.release)
  env.connect(gate).connect(dest)

  // 합주 느낌이 있으면 두 대를 어긋나게 켜고, 아니면 한 대
  const detunes = timbre.ensemble ? [-timbre.ensemble, timbre.ensemble] : [0]
  const voiceGain = 1 / detunes.length
  for (const cents of detunes) {
    const osc = ctx.createOscillator()
    osc.setPeriodicWave(wave)
    osc.frequency.value = hz
    osc.detune.value = cents
    if (detunes.length > 1) {
      const g = ctx.createGain()
      g.gain.value = voiceGain
      osc.connect(g).connect(env)
    } else osc.connect(env)

    if (timbre.vibrato) {
      const { rate, depth, delay } = timbre.vibrato
      const lfo = ctx.createOscillator()
      lfo.frequency.value = rate
      const depthGain = ctx.createGain()
      depthGain.gain.setValueAtTime(0, when)
      depthGain.gain.linearRampToValueAtTime(depth, when + delay + 0.35) // 음이 시작한 뒤 서서히 떨리기 시작한다
      lfo.connect(depthGain).connect(osc.detune)
      lfo.start(when)
      lfo.stop(stopAt)
    }
    osc.start(when)
    osc.stop(stopAt)
  }
}

export function createWave(ctx: BaseAudioContext, timbre: Timbre = TIMBRES.piano): PeriodicWave {
  const real = new Float32Array(timbre.harmonics.length)
  return ctx.createPeriodicWave(real, Float32Array.from(timbre.harmonics))
}

/** 여러 음이 겹쳐도 찌그러지지 않게 하는 출력단 */
export function createMaster(ctx: BaseAudioContext, volume = 0.5): AudioNode {
  const comp = ctx.createDynamicsCompressor()
  const gain = ctx.createGain()
  gain.gain.value = volume
  comp.connect(gain).connect(ctx.destination)
  return comp
}

/** 시간표 전체를 한 번에 예약한다(시험·짧은 곡용). 실제 재생은 ScorePlayer가 조금씩 예약한다. */
export function scheduleAll(
  ctx: BaseAudioContext,
  notes: PlayNote[],
  startAt = 0,
  speed = 1,
  timbreId: SynthTimbreId = 'piano',
) {
  const timbre = TIMBRES[timbreId]
  const dest = createMaster(ctx)
  const wave = createWave(ctx, timbre)
  for (const n of notes) {
    if (n.drum) scheduleDrum(ctx, dest, n.midi, startAt + n.start / speed)
    else
      scheduleNote(ctx, dest, wave, { midi: n.midi, duration: n.duration / speed }, startAt + n.start / speed, timbre)
  }
}
