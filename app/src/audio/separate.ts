/**
 * 목소리 분리 (Open-Unmix UMX-HQ의 목소리 모델). 44.1kHz 스테레오를 받아 목소리만 남긴 모노를 돌려준다.
 * 모델은 원본의 크기 스펙트로그램을 받아 목소리의 크기를 추정한다. "추정 / 원본"(최대 1)을 원본에 가림막으로 씌운 뒤
 * 원본의 위상으로 되돌린다.
 */
export const SEPARATION_RATE = 44100
const N = 4096
const HOP = 1024
export const MODEL_BINS = N / 2 + 1
/** 모델에 한 번에 넣는 프레임 수 (약 6초). 학습할 때의 길이와 비슷하게 나눠 메모리를 아낀다 */
export const MODEL_FRAMES = 256

/** 입력·출력 모양: [채널 2][주파수 2049][프레임 frames] */
export type SeparationModel = (magnitudes: Float32Array, frames: number) => Promise<Float32Array>

const window_ = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N))
const cos = Float64Array.from({ length: N / 2 }, (_, i) => Math.cos((2 * Math.PI * i) / N))
const sin = Float64Array.from({ length: N / 2 }, (_, i) => Math.sin((2 * Math.PI * i) / N))

/** 제자리 FFT (길이 N 고정). inverse면 부호만 바꾸며 1/N은 부르는 쪽에서 곱한다 */
function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const r = re[i]
      re[i] = re[j]
      re[j] = r
      const m = im[i]
      im[i] = im[j]
      im[j] = m
    }
  }
  const sign = inverse ? 1 : -1
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1
    const step = N / size
    for (let start = 0; start < N; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step]
        const wi = sign * sin[k * step]
        const p = start + k
        const q = p + half
        const xr = re[q] * wr - im[q] * wi
        const xi = re[q] * wi + im[q] * wr
        re[q] = re[p] - xr
        im[q] = im[p] - xi
        re[p] += xr
        im[p] += xi
      }
    }
  }
}

export interface Separated {
  /** 목소리만 남긴 모노 44.1kHz */
  vocals: Float32Array
  /** 목소리의 크기(RMS) / 원본의 크기. 목소리가 거의 없는 곡은 0에 가깝다 */
  ratio: number
}

export async function separateVocals(
  left: Float32Array,
  right: Float32Array,
  model: SeparationModel,
  onProgress: (percent: number) => void = () => {},
): Promise<Separated> {
  const length = left.length
  const channels = [left, right]
  // 프레임의 가운데가 0, HOP, 2·HOP …에 오게 하고, 바깥은 거울처럼 되비춰 읽는다 (Open-Unmix의 STFT와 같다)
  const frames = 1 + Math.floor(length / HOP)
  const mirror = (i: number) => {
    const j = i < 0 ? -i : i >= length ? 2 * length - 2 - i : i
    return Math.max(0, Math.min(length - 1, j))
  }
  const out = new Float32Array(length)
  const norm = new Float32Array(length)
  const re = new Float64Array(N)
  const im = new Float64Array(N)

  for (let first = 0; first < frames; first += MODEL_FRAMES) {
    onProgress((first / frames) * 100)
    const count = Math.min(MODEL_FRAMES, frames - first)
    const size = MODEL_BINS * count
    const mag = new Float32Array(2 * size)
    const spectra = channels.map((pcm, c) => {
      const real = new Float32Array(size)
      const imag = new Float32Array(size)
      for (let f = 0; f < count; f++) {
        const at = (first + f) * HOP - N / 2
        for (let k = 0; k < N; k++) {
          re[k] = pcm[mirror(at + k)] * window_[k]
          im[k] = 0
        }
        fft(re, im, false)
        for (let b = 0; b < MODEL_BINS; b++) {
          const j = b * count + f
          real[j] = re[b]
          imag[j] = im[b]
          mag[c * size + j] = Math.hypot(re[b], im[b])
        }
      }
      return { real, imag }
    })
    // 모델이 입력을 가져가도 계산에 쓸 수 있게 복사본을 넘긴다
    const estimate = await model(mag.slice(), count)
    // 두 채널의 목소리를 합쳐(평균) 한 번에 되돌린다
    for (let f = 0; f < count; f++) {
      for (let b = 0; b < MODEL_BINS; b++) {
        const j = b * count + f
        let r = 0
        let i = 0
        for (let c = 0; c < 2; c++) {
          const m = mag[c * size + j]
          const mask = m > 1e-9 ? Math.min(1, estimate[c * size + j] / m) : 0
          r += (spectra[c].real[j] * mask) / 2
          i += (spectra[c].imag[j] * mask) / 2
        }
        re[b] = r
        im[b] = i
        if (b > 0 && b < N / 2) {
          re[N - b] = r
          im[N - b] = -i
        }
      }
      fft(re, im, true)
      const at = (first + f) * HOP - N / 2
      for (let k = 0; k < N; k++) {
        const p = at + k
        if (p < 0 || p >= length) continue
        out[p] += (re[k] / N) * window_[k]
        norm[p] += window_[k] ** 2
      }
    }
  }
  let voice = 0
  let mix = 0
  for (let p = 0; p < length; p++) {
    out[p] /= Math.max(norm[p], 1e-6)
    voice += out[p] ** 2
    mix += ((left[p] + right[p]) / 2) ** 2
  }
  onProgress(100)
  return { vocals: out, ratio: mix > 0 ? Math.sqrt(voice / mix) : 0 }
}
