import type { PlayNote } from './timeline'

/** 피아노처럼 들리게 하는 배음 구성 (기본음 + 약해지는 배음들) */
const HARMONICS = [0, 1, 0.55, 0.3, 0.18, 0.1, 0.06, 0.035]

export const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** 한 음을 예약한다. 외부 음원 파일 없이 브라우저가 만든 소리만 쓴다 (BaseContext라서 오프라인 렌더로 시험할 수 있다). */
export function scheduleNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  wave: PeriodicWave,
  note: { midi: number; duration: number; velocity?: number },
  when: number,
) {
  const vel = note.velocity ?? 0.8
  const osc = ctx.createOscillator()
  osc.setPeriodicWave(wave)
  osc.frequency.value = midiToHz(note.midi)

  // 소리 크기 변화: 짧게 시작해서 피아노처럼 서서히 줄어든다 (높은 음일수록 빨리 사라진다)
  const env = ctx.createGain()
  const decay = 0.6 + Math.max(0, 96 - note.midi) / 28
  env.gain.setValueAtTime(0.0001, when)
  env.gain.linearRampToValueAtTime(vel * 0.5, when + 0.006)
  env.gain.setTargetAtTime(vel * 0.12, when + 0.006, decay / 2.5)

  // 음이 끝나면 부드럽게 끊는다
  const gate = ctx.createGain()
  const end = when + Math.max(0.05, note.duration)
  gate.gain.setValueAtTime(1, when)
  gate.gain.setTargetAtTime(0, end, 0.07)

  osc.connect(env).connect(gate).connect(dest)
  osc.start(when)
  osc.stop(end + 0.6)
}

export function createWave(ctx: BaseAudioContext): PeriodicWave {
  const real = new Float32Array(HARMONICS.length)
  return ctx.createPeriodicWave(real, Float32Array.from(HARMONICS))
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
export function scheduleAll(ctx: BaseAudioContext, notes: PlayNote[], startAt = 0, speed = 1) {
  const dest = createMaster(ctx)
  const wave = createWave(ctx)
  for (const n of notes)
    scheduleNote(ctx, dest, wave, { midi: n.midi, duration: n.duration / speed }, startAt + n.start / speed)
}
