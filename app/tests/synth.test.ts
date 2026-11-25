import { INSTRUMENT_TIMBRES, instrumentSound } from '../src/play/instruments'
import { soundOf } from '../src/play/player'
import { describe, expect, it } from 'vitest'
import { createWave, DEFAULT_TIMBRE, scheduleNote, SYNTH_TIMBRE_IDS, TIMBRE_IDS, TIMBRES } from '../src/play/synth'
import { t } from '../src/text'

/** 만들어진 소리 부품의 종류를 세기만 하는 가짜 오디오 장치 (Node에는 Web Audio가 없다) */
function fakeCtx() {
  const made = { oscillator: 0, gain: 0, started: 0, stopped: 0, waves: 0 }
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} })
  const node = (): Record<string, unknown> => {
    const n: Record<string, unknown> = {}
    n.connect = (to: unknown) => to
    return n
  }
  const ctx = {
    createGain: () => {
      made.gain++
      return { ...node(), gain: param() }
    },
    createOscillator: () => {
      made.oscillator++
      return {
        ...node(),
        frequency: param(),
        detune: param(),
        setPeriodicWave() {},
        start: () => made.started++,
        stop: () => made.stopped++,
      }
    },
    createPeriodicWave: () => {
      made.waves++
      return {}
    },
  }
  return { ctx: ctx as unknown as BaseAudioContext, made }
}

describe('재생 소리 (합성음 6종 + 화면 이름)', () => {
  it('소리는 악기별 소리 + 실제 피아노 + 합성음 6종이고 기본은 악기별 소리다', () => {
    expect(SYNTH_TIMBRE_IDS).toEqual(['piano', 'organ', 'strings', 'flute', 'bell', 'harpsichord'])
    expect(TIMBRE_IDS).toEqual(['auto', 'grandPiano', ...SYNTH_TIMBRE_IDS])
    expect(DEFAULT_TIMBRE).toBe('auto')
  })

  it('악기 번호 0~127 모두에 소리가 있고 계열이 맞다', () => {
    for (let p = 0; p <= 127; p++) {
      const s = instrumentSound(p)
      expect(s === 'grandPiano' || s in INSTRUMENT_TIMBRES, `${p}`).toBe(true)
    }
    const pick = [0, 4, 24, 33, 40, 48, 56, 68, 71, 73, 98].map(instrumentSound)
    expect(pick).toEqual([
      'grandPiano',
      'electricPiano',
      'nylonGuitar',
      'bass',
      'bowed',
      'strings',
      'brass',
      'reed',
      'clarinet',
      'flute',
      'bell',
    ])
  })

  it('악기별 소리는 음의 악기 번호를 따르고, 다른 소리를 고르면 모두 그 소리다', () => {
    const note = { start: 0, duration: 1, midi: 40, step: 0, program: 33 }
    expect(soundOf(note, 'auto')).toBe('bass')
    expect(soundOf(note, 'organ')).toBe('organ')
  })

  it('모든 소리에 화면 이름이 있다', () => {
    for (const id of TIMBRE_IDS) expect(t.panel.timbres[id], id).toBeTruthy()
  })

  it('모든 소리의 값이 올바른 범위에 있다', () => {
    for (const id of SYNTH_TIMBRE_IDS) {
      const tm = TIMBRES[id]
      expect(tm.harmonics[0], `${id} 0번 배음은 쓰지 않는다`).toBe(0)
      expect(tm.harmonics[1], `${id} 기본음`).toBeGreaterThan(0)
      expect(tm.harmonics.every((h) => h >= 0 && h <= 1)).toBe(true)
      expect(tm.attack).toBeGreaterThan(0)
      expect(tm.level).toBeGreaterThan(0)
      expect(tm.level).toBeLessThanOrEqual(1)
      expect(tm.sustain).toBeGreaterThan(0)
      expect(tm.sustain).toBeLessThanOrEqual(1)
      expect(tm.release).toBeGreaterThan(0)
      for (const midi of [36, 60, 96]) expect(tm.decay(midi), `${id} ${midi}`).toBeGreaterThan(0)
    }
  })

  it('피아노는 높은 음일수록 빨리 사라진다', () => {
    expect(TIMBRES.piano.decay(36)).toBeGreaterThan(TIMBRES.piano.decay(90))
  })

  it('음마다 부품을 만든다: 피아노 1대, 현악은 어긋난 2대와 떨림 2개', () => {
    const piano = fakeCtx()
    scheduleNote(piano.ctx, {} as AudioNode, createWave(piano.ctx), { midi: 60, duration: 1 }, 0, TIMBRES.piano)
    expect(piano.made.oscillator).toBe(1)
    expect(piano.made.started).toBe(1)
    expect(piano.made.stopped).toBe(1)

    const strings = fakeCtx()
    scheduleNote(strings.ctx, {} as AudioNode, createWave(strings.ctx), { midi: 60, duration: 1 }, 0, TIMBRES.strings)
    expect(strings.made.oscillator).toBe(4) // 소리 2대 + 떨림 2개
    expect(strings.made.started).toBe(4)
    expect(strings.made.stopped).toBe(4)
  })

  it('모든 소리가 오류 없이 음을 예약하고 만든 부품을 모두 시작·정지한다', () => {
    for (const id of SYNTH_TIMBRE_IDS) {
      const f = fakeCtx()
      scheduleNote(
        f.ctx,
        {} as AudioNode,
        createWave(f.ctx, TIMBRES[id]),
        { midi: 72, duration: 0.5, velocity: 0.6 },
        1,
        TIMBRES[id],
      )
      expect(f.made.started, id).toBe(f.made.oscillator)
      expect(f.made.stopped, id).toBe(f.made.oscillator)
    }
  })
})
