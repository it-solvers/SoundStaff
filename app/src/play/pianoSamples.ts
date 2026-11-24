/**
 * 실제 피아노 소리 (Salamander Grand Piano, 야마하 C5 녹음, 저작자 Alexander Holm, CC BY 3.0).
 * 단3도 간격으로 녹음된 30개 mp3(A0~C8)를 public/piano에 두고, 그 사이의 음은 재생 속도를 바꿔 만든다.
 * 메모리와 불러오는 시간을 아끼려고 곡에서 쓰는 음역의 샘플만 불러온다.
 */

/** 샘플 이름 → 음높이(MIDI). 이름은 파일 이름이고 Ds는 D#이다 */
export const PIANO_SAMPLES: { name: string; midi: number }[] = (() => {
  const letters: Record<string, number> = { C: 0, Ds: 3, Fs: 6, A: 9 }
  const out: { name: string; midi: number }[] = []
  for (let octave = 0; octave <= 8; octave++) {
    for (const [letter, semi] of Object.entries(letters)) {
      const midi = 12 * (octave + 1) + semi
      if (midi < 21 || midi > 108) continue // 피아노 음역 A0(21) ~ C8(108)
      out.push({ name: `${letter}${octave}`, midi })
    }
  }
  return out.sort((a, b) => a.midi - b.midi)
})()

/** 한 음을 낼 샘플과 재생 속도 비율: 가장 가까운 샘플을 고르고 차이만큼 속도를 바꾼다 */
export function sampleFor(midi: number): { name: string; rate: number } {
  let best = PIANO_SAMPLES[0]
  for (const s of PIANO_SAMPLES) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s
  return { name: best.name, rate: Math.pow(2, (midi - best.midi) / 12) }
}

/** 이 음들을 내는 데 필요한 샘플 이름 */
export function neededSamples(midis: Iterable<number>): string[] {
  const names = new Set<string>()
  for (const m of midis) names.add(sampleFor(m).name)
  return [...names]
}

/** 메모리를 아끼려고 샘플은 이 길이(초)까지만 쓴다 (낮은 음의 긴 여운은 잘린다) */
export const MAX_SAMPLE_SECONDS = 10

/** 샘플 첫 1초의 최대 진폭을 이 값에 맞춘다. 녹음 음량이 음역마다 달라서(높은 음이 훨씬 작다) 그대로 쓰면 음량이 들쭉날쭉하다 */
export const TARGET_PEAK = 0.5
const MAX_LEVEL_GAIN = 6

const levels = new WeakMap<AudioBuffer, number>()
/** 샘플마다 음량을 맞추는 배율 */
export const sampleLevel = (buf: AudioBuffer): number => levels.get(buf) ?? 1

const rawCache = new Map<string, Promise<ArrayBuffer>>()
const decodedCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>()

const sampleUrl = (name: string) => `${import.meta.env.BASE_URL}piano/${name}.mp3`

/** 샘플 파일을 한 번만 내려받는다 (실패하면 다음에 다시 시도하도록 기억하지 않는다) */
function fetchRaw(name: string): Promise<ArrayBuffer> {
  let p = rawCache.get(name)
  if (!p) {
    p = fetch(sampleUrl(name)).then((r) => {
      if (!r.ok) throw new Error(`piano sample ${name}: HTTP ${r.status}`)
      return r.arrayBuffer()
    })
    p.catch(() => rawCache.delete(name))
    rawCache.set(name, p)
  }
  return p
}

/**
 * 디코딩한 샘플을 가볍게 만든다: 모노로 합치고(메모리 절반) 앞 MAX_SAMPLE_SECONDS초만 남기며,
 * 첫 1초의 최대 진폭을 기준으로 음량 배율을 정한다.
 */
function prepare(ctx: BaseAudioContext, buf: AudioBuffer): AudioBuffer {
  const length = Math.min(buf.length, Math.floor(MAX_SAMPLE_SECONDS * buf.sampleRate))
  const mono = new Float32Array(length)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c)
    for (let i = 0; i < length; i++) mono[i] += ch[i] / buf.numberOfChannels
  }
  const out = ctx.createBuffer(1, length, buf.sampleRate)
  out.copyToChannel(mono, 0)
  let peak = 0
  const first = Math.min(length, buf.sampleRate)
  for (let i = 0; i < first; i++) peak = Math.max(peak, Math.abs(mono[i]))
  levels.set(out, peak > 0 ? Math.min(MAX_LEVEL_GAIN, TARGET_PEAK / peak) : 1)
  return out
}

/** 필요한 샘플을 모두 불러와 디코딩한다. 하나라도 실패하면 오류를 던진다 */
export async function loadPianoSamples(
  ctx: BaseAudioContext,
  midis: Iterable<number>,
): Promise<Map<string, AudioBuffer>> {
  let decoded = decodedCache.get(ctx)
  if (!decoded) {
    decoded = new Map()
    decodedCache.set(ctx, decoded)
  }
  const have = decoded
  await Promise.all(
    neededSamples(midis).map(async (name) => {
      if (have.has(name)) return
      const raw = await fetchRaw(name)
      // decodeAudioData는 넘긴 버퍼를 비우므로 복사본을 넘긴다 (다시 쓸 수 있게)
      const buf = await ctx.decodeAudioData(raw.slice(0))
      have.set(name, prepare(ctx, buf))
    }),
  )
  return have
}

/** 샘플 피아노로 한 음을 예약한다 */
export function scheduleSample(
  ctx: BaseAudioContext,
  dest: AudioNode,
  samples: Map<string, AudioBuffer>,
  note: { midi: number; duration: number; velocity?: number },
  when: number,
) {
  const { name, rate } = sampleFor(note.midi)
  const buffer = samples.get(name)
  if (!buffer) return
  const vel = note.velocity ?? 0.8
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate

  const env = ctx.createGain()
  env.gain.value = vel * sampleLevel(buffer)
  // 음이 끝나면 부드럽게 끊는다 (피아노는 건반을 떼면 소리가 사라진다)
  const end = when + Math.max(0.05, note.duration)
  const gate = ctx.createGain()
  gate.gain.setValueAtTime(1, when)
  gate.gain.setTargetAtTime(0, end, 0.16)
  src.connect(env).connect(gate).connect(dest)
  src.start(when)
  src.stop(end + 1.4)
}
