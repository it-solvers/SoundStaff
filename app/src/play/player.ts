import { scheduleDrum } from './drums'
import { INSTRUMENT_TIMBRES, instrumentSound, type InstrumentSound } from './instruments'
import { loadPianoSamples, scheduleSample } from './pianoSamples'
import { createMaster, createWave, DEFAULT_TIMBRE, scheduleNote, TIMBRES, type Timbre, type TimbreId } from './synth'
import type { PlayNote, Timeline } from './timeline'

export type PlayState = 'stopped' | 'loading' | 'playing' | 'paused'

interface Callbacks {
  /** 재생 위치(초, 배속과 상관없는 악보 기준 시간)가 바뀔 때마다 */
  onTick: (posSec: number) => void
  onState: (state: PlayState) => void
  /** 실제 피아노 소리를 불러오지 못해 합성 피아노로 바꿔 재생할 때 */
  onFallback?: () => void
}

/** 앞으로 이 시간(초) 안에 시작하는 음만 미리 예약한다. 긴 곡도 한꺼번에 예약하지 않아 가볍다. */
const LOOKAHEAD = 1.5
const SCHEDULE_EVERY_MS = 80
const START_DELAY = 0.12

/** 고른 소리에서 이 음을 낼 소리 (타악기는 따로 처리한다) */
export function soundOf(note: PlayNote, timbre: TimbreId): InstrumentSound {
  return timbre === 'auto' ? instrumentSound(note.program ?? 0) : timbre
}

/**
 * 시간표를 Web Audio로 재생한다. 소리는 악기별 소리, 실제 피아노(앱에 포함된 샘플, 외부 서버 요청 없음) 또는 합성음이다.
 * 재생·일시정지·이어서 재생·정지를 지원하며, 위치는 소리 시계(AudioContext.currentTime)를 따라 정확히 맞는다.
 */
export class ScorePlayer {
  state: PlayState = 'stopped'
  private ctx: AudioContext | null = null
  private dest: AudioNode | null = null
  private timbre: TimbreId = DEFAULT_TIMBRE
  private waves = new Map<Timbre, PeriodicWave>()
  private samples: Map<string, AudioBuffer> | null = null
  private t0 = 0
  private speed = 1
  private idx = 0
  private timer: ReturnType<typeof setInterval> | undefined
  private raf = 0

  private timeline: Timeline
  private cb: Callbacks

  constructor(timeline: Timeline, cb: Callbacks) {
    this.timeline = timeline
    this.cb = cb
  }

  private set(state: PlayState) {
    this.state = state
    this.cb.onState(state)
  }

  /** 처음부터 재생한다. 소리 장치는 사용자가 누른 순간(클릭 처리 중)에 열어야 브라우저가 허용한다. */
  async play(speed = 1, timbre: TimbreId = DEFAULT_TIMBRE) {
    this.stop()
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx
    this.dest = createMaster(ctx)
    this.speed = speed
    this.idx = 0
    this.samples = null
    this.timbre = timbre
    this.waves = new Map()
    if (ctx.state === 'suspended') await ctx.resume()

    // 녹음한 피아노를 쓰는 음이 있으면, 그 음역의 샘플을 불러온 뒤 시작한다. 불러오는 동안 정지를 누르면 그만둔다.
    const pitches = this.timeline.notes.filter((n) => !n.drum && soundOf(n, timbre) === 'grandPiano').map((n) => n.midi)
    if (pitches.length) {
      this.set('loading')
      try {
        const samples = await loadPianoSamples(ctx, new Set(pitches))
        if (this.ctx !== ctx) return // 불러오는 사이에 정지했다
        this.samples = samples
      } catch (err) {
        if (this.ctx !== ctx) return
        console.error(err)
        this.cb.onFallback?.() // 합성 피아노로 대신 들려준다
      }
    }
    this.t0 = ctx.currentTime + START_DELAY
    this.set('playing')
    this.pump()
    this.timer = setInterval(() => this.pump(), SCHEDULE_EVERY_MS)
    this.loop()
  }

  /** 곧 시작할 음을 예약한다 */
  private pump() {
    const ctx = this.ctx
    if (!ctx || !this.dest || this.state !== 'playing') return
    const horizon = ctx.currentTime + LOOKAHEAD
    const notes = this.timeline.notes
    while (this.idx < notes.length) {
      const n = notes[this.idx]
      const when = this.t0 + n.start / this.speed
      if (when > horizon) break
      const note = { midi: n.midi, duration: n.duration / this.speed }
      const at = Math.max(when, ctx.currentTime)
      if (n.drum) scheduleDrum(ctx, this.dest, n.midi, at)
      else {
        const sound = soundOf(n, this.timbre)
        if (sound === 'grandPiano' && this.samples) scheduleSample(ctx, this.dest, this.samples, note, at)
        else {
          // 녹음 피아노를 불러오지 못했으면 합성 피아노
          const timbre = sound === 'grandPiano' ? TIMBRES.piano : INSTRUMENT_TIMBRES[sound]
          let wave = this.waves.get(timbre)
          if (!wave) this.waves.set(timbre, (wave = createWave(ctx, timbre)))
          scheduleNote(ctx, this.dest, wave, note, at, timbre)
        }
      }
      this.idx++
    }
  }

  private position(): number {
    const ctx = this.ctx
    return ctx ? Math.max(0, ctx.currentTime - this.t0) * this.speed : 0
  }

  private loop = () => {
    if (this.state !== 'playing') return
    const pos = this.position()
    this.cb.onTick(Math.min(pos, this.timeline.totalSeconds))
    // 마지막 소리의 여운까지 들려준 뒤 끝낸다
    if (pos >= this.timeline.totalSeconds + 0.6) {
      this.stop()
      return
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  async pause() {
    if (this.state !== 'playing' || !this.ctx) return
    cancelAnimationFrame(this.raf)
    await this.ctx.suspend()
    this.set('paused')
  }

  async resume() {
    if (this.state !== 'paused' || !this.ctx) return
    await this.ctx.resume()
    this.set('playing')
    this.loop()
  }

  stop() {
    clearInterval(this.timer)
    cancelAnimationFrame(this.raf)
    const ctx = this.ctx
    this.ctx = null
    this.dest = null
    this.samples = null
    if (ctx) void ctx.close().catch(() => {})
    if (this.state !== 'stopped') {
      this.set('stopped')
      this.cb.onTick(0)
    }
  }
}

export const formatClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
