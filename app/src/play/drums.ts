/**
 * 타악기 합성음. 외부 음원 파일 없이 브라우저가 만든 소리(진동자 + 잡음)로 GM 타악기(35~81)를 흉내 낸다.
 * 진짜 드럼 녹음과는 다르며, 어떤 악기가 언제 울리는지 구별할 수 있게 하는 것이 목표다.
 */

/** 음높이가 있는 성분: freq에서 시작해 to까지 미끄러지며 decay초 동안 사라진다 */
export interface ToneLayer {
  kind: 'tone'
  wave: OscillatorType
  freq: number
  to?: number
  decay: number
  level: number
  delay?: number
}

/** 잡음 성분: 필터로 음색을 만든다 */
export interface NoiseLayer {
  kind: 'noise'
  filter: BiquadFilterType
  freq: number
  decay: number
  level: number
  delay?: number
}

export type DrumLayer = ToneLayer | NoiseLayer

const tone = (freq: number, decay: number, level: number, o: Partial<ToneLayer> = {}): ToneLayer => ({
  kind: 'tone',
  wave: 'sine',
  freq,
  decay,
  level,
  ...o,
})
const noise = (filter: BiquadFilterType, freq: number, decay: number, level: number, delay = 0): NoiseLayer => ({
  kind: 'noise',
  filter,
  freq,
  decay,
  level,
  delay,
})

const kick = (freq: number) => [tone(freq, 0.35, 1, { to: 45 }), noise('lowpass', 1200, 0.02, 0.3)]
const snare = (freq: number) => [noise('highpass', 1500, 0.18, 0.55), tone(freq, 0.12, 0.5, { wave: 'triangle' })]
const tom = (freq: number) => [tone(freq, 0.35, 0.8, { to: freq * 0.7 }), noise('bandpass', freq * 6, 0.04, 0.2)]
const hat = (decay: number) => [noise('highpass', 8000, decay, 0.35)]
const cymbal = (decay: number, freq = 5000) => [
  noise('highpass', freq, decay, 0.4),
  noise('bandpass', 9000, decay, 0.2),
]
const ride = () => [noise('highpass', 7000, 0.5, 0.2), tone(3150, 0.4, 0.08, { wave: 'square' })]
const skin = (freq: number, decay = 0.18) => [tone(freq, decay, 0.6, { to: freq * 0.85 })]
const metal = (freq: number, decay: number) => [
  tone(freq, decay, 0.18, { wave: 'square' }),
  tone(freq * 1.48, decay, 0.14, { wave: 'square' }),
]
const click = (freq: number, decay = 0.05) => [tone(freq, decay, 0.5, { wave: 'triangle' })]
const shaker = (decay: number) => [noise('bandpass', 6500, decay, 0.4)]
const scrape = (count: number) =>
  Array.from({ length: count }, (_, i) => noise('bandpass', 3000, 0.025, 0.35, i * 0.035))

const RECIPES: Record<number, DrumLayer[]> = {
  35: kick(120),
  36: kick(150),
  37: [...click(1700, 0.03), noise('bandpass', 2500, 0.03, 0.3)],
  38: snare(190),
  39: [0, 0.012, 0.024].map((d) => noise('bandpass', 1200, 0.09, 0.5, d)),
  40: snare(230),
  41: tom(85),
  42: hat(0.05),
  43: tom(105),
  44: hat(0.035),
  45: tom(125),
  46: hat(0.35),
  47: tom(150),
  48: tom(180),
  49: cymbal(1.3),
  50: tom(215),
  51: ride(),
  52: cymbal(1, 2500),
  53: metal(900, 0.5),
  54: [...shaker(0.15), ...metal(5200, 0.08)],
  55: cymbal(0.5, 6000),
  56: metal(540, 0.25),
  57: cymbal(1.4, 4200),
  58: scrape(8),
  59: ride(),
  60: skin(420),
  61: skin(320),
  62: skin(300, 0.07),
  63: skin(270, 0.25),
  64: skin(200, 0.28),
  65: [...skin(360), noise('highpass', 3000, 0.08, 0.2)],
  66: [...skin(260), noise('highpass', 3000, 0.08, 0.2)],
  67: metal(900, 0.2),
  68: metal(650, 0.2),
  69: shaker(0.08),
  70: shaker(0.05),
  71: [tone(2400, 0.12, 0.25)],
  72: [tone(2200, 0.45, 0.25)],
  73: scrape(3),
  74: scrape(9),
  75: click(2500),
  76: click(1100, 0.07),
  77: click(800, 0.07),
  78: [tone(450, 0.1, 0.4, { to: 650 })],
  79: [tone(700, 0.25, 0.4, { to: 350 })],
  80: [tone(4400, 0.07, 0.2)],
  81: [tone(4400, 0.9, 0.2)],
}

export const drumRecipe = (midi: number): DrumLayer[] => RECIPES[midi] ?? []

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

/** 가장 긴 소리보다 긴 흰 잡음 한 토막 (소리 장치마다 한 번만 만든다) */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx)
  if (!buf) {
    buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, buf)
  }
  return buf
}

/** 타격 하나를 예약한다. 타악기는 음 길이와 상관없이 악기마다 정해진 시간 동안 울린다. */
export function scheduleDrum(ctx: BaseAudioContext, dest: AudioNode, midi: number, when: number) {
  for (const layer of drumRecipe(midi)) {
    const at = when + (layer.delay ?? 0)
    const stopAt = at + layer.decay + 0.05
    const env = ctx.createGain()
    env.gain.setValueAtTime(layer.level * 0.7, at)
    env.gain.exponentialRampToValueAtTime(0.001, at + layer.decay)
    env.connect(dest)
    if (layer.kind === 'tone') {
      const osc = ctx.createOscillator()
      osc.type = layer.wave
      osc.frequency.setValueAtTime(layer.freq, at)
      if (layer.to) osc.frequency.exponentialRampToValueAtTime(layer.to, at + layer.decay * 0.6)
      osc.connect(env)
      osc.start(at)
      osc.stop(stopAt)
    } else {
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(ctx)
      const filter = ctx.createBiquadFilter()
      filter.type = layer.filter
      filter.frequency.value = layer.freq
      src.connect(filter).connect(env)
      src.start(at)
      src.stop(stopAt)
    }
  }
}
