import { createMaster, createWave, scheduleNote } from './synth'
import type { Timeline } from './timeline'

export type PlayState = 'stopped' | 'playing' | 'paused'

interface Callbacks {
  /** 재생 위치(초, 배속과 상관없는 악보 기준 시간)가 바뀔 때마다 */
  onTick: (posSec: number) => void
  onState: (state: PlayState) => void
}

/** 앞으로 이 시간(초) 안에 시작하는 음만 미리 예약한다. 긴 곡도 한꺼번에 예약하지 않아 가볍다. */
const LOOKAHEAD = 1.5
const SCHEDULE_EVERY_MS = 80
const START_DELAY = 0.12

/**
 * 시간표를 Web Audio로 재생한다 (외부 음원 파일·네트워크 없음).
 * 재생·일시정지·이어서 재생·정지를 지원하며, 위치는 소리 시계(AudioContext.currentTime)를 따라 정확히 맞는다.
 */
export class ScorePlayer {
  state: PlayState = 'stopped'
  private ctx: AudioContext | null = null
  private dest: AudioNode | null = null
  private wave: PeriodicWave | null = null
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
  async play(speed = 1) {
    this.stop()
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx
    this.dest = createMaster(ctx)
    this.wave = createWave(ctx)
    this.speed = speed
    this.idx = 0
    if (ctx.state === 'suspended') await ctx.resume()
    this.t0 = ctx.currentTime + START_DELAY
    this.set('playing')
    this.pump()
    this.timer = setInterval(() => this.pump(), SCHEDULE_EVERY_MS)
    this.loop()
  }

  /** 곧 시작할 음을 예약한다 */
  private pump() {
    const ctx = this.ctx
    if (!ctx || !this.dest || !this.wave) return
    const horizon = ctx.currentTime + LOOKAHEAD
    const notes = this.timeline.notes
    while (this.idx < notes.length) {
      const n = notes[this.idx]
      const when = this.t0 + n.start / this.speed
      if (when > horizon) break
      scheduleNote(
        ctx,
        this.dest,
        this.wave,
        { midi: n.midi, duration: n.duration / this.speed },
        Math.max(when, ctx.currentTime),
      )
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
    this.wave = null
    if (ctx) void ctx.close().catch(() => {})
    if (this.state !== 'stopped') {
      this.set('stopped')
      this.cb.onTick(0)
    }
  }
}

export const formatClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
