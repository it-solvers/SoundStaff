import { describe, expect, it } from 'vitest'
import { isPhoneOrTablet } from '../src/audio/device'
import { AUDIO_EXTENSIONS, kindOfFile, MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from '../src/audio/format'
import { estimateKey } from '../src/audio/key'
import { filterNotes, MIN_CONFIDENCE, MIN_NOTE_SECONDS } from '../src/audio/notes'
import { estimateBpmFromAudio, estimateBpmFromNotes } from '../src/audio/tempo'
import { audioToInfo, toNoteEvents } from '../src/audio/toInfo'
import type { AudioNote } from '../src/midi/types'
import { materializeAudio } from '../src/score/audioInfo'
import { buildInstrumentScore } from '../src/score/buildScore'
import { buildPianoMidi } from '../src/score/exportPianoMidi'
import { applySettings } from '../src/score/settings'
import { info, track } from './helpers'

const note = (startSec: number, durationSec: number, midi: number, velocity = 0.8): AudioNote => ({
  startSec,
  durationSec,
  midi,
  velocity,
})

describe('파일 종류 (kindOfFile)', () => {
  it('MIDI, 음원, 그 밖을 구분하고 대소문자를 가리지 않는다', () => {
    expect(['a.mid', 'a.MIDI', 'a.Mid'].map(kindOfFile)).toEqual(['midi', 'midi', 'midi'])
    expect(['a.mp3', 'a.WAV', 'a.m4a', 'a.ogg', 'a.flac'].map(kindOfFile)).toEqual(Array(5).fill('audio'))
    expect(['a.txt', 'a', 'a.pdf', 'mid'].map(kindOfFile)).toEqual(Array(4).fill('unknown'))
    expect(AUDIO_EXTENSIONS).toEqual(['mp3', 'wav', 'm4a', 'ogg', 'flac'])
  })
  it('기획서 상한: 음원 50MB, 10분', () => {
    expect(MAX_AUDIO_BYTES).toBe(50 * 1024 * 1024)
    expect(MAX_AUDIO_SECONDS).toBe(600)
  })
})

describe('폰·태블릿 판별 (isPhoneOrTablet)', () => {
  const env = (width: number, coarsePointer = false, uaMobile = false) => ({ width, coarsePointer, uaMobile })
  it('너비 768px 미만은 폰', () => {
    expect(isPhoneOrTablet(env(390))).toBe(true)
    expect(isPhoneOrTablet(env(767))).toBe(true)
  })
  it('터치 기기이면서 1024px 미만은 태블릿', () => {
    expect(isPhoneOrTablet(env(820, true))).toBe(true)
    expect(isPhoneOrTablet(env(1023, true))).toBe(true)
  })
  it('브라우저가 모바일이라고 알리면 화면이 커도 폰·태블릿', () => {
    expect(isPhoneOrTablet(env(1366, false, true))).toBe(true)
  })
  it('PC(넓은 화면, 마우스)는 해당하지 않는다', () => {
    expect(isPhoneOrTablet(env(1280))).toBe(false)
    expect(isPhoneOrTablet(env(768))).toBe(false) // 경계: 768은 PC
    expect(isPhoneOrTablet(env(1024, true))).toBe(false) // 터치 노트북 등 큰 화면
    expect(isPhoneOrTablet(env(900, false))).toBe(false)
  })
})

describe('음표 거르기 (filterNotes)', () => {
  it('너무 짧거나 신뢰도가 낮은 음표를 지우고 시작 순서로 정렬한다', () => {
    const raw = [
      note(2, 0.5, 60),
      note(1, MIN_NOTE_SECONDS - 0.01, 62), // 너무 짧음
      note(0, 0.5, 64, MIN_CONFIDENCE - 0.01), // 신뢰도 낮음
      note(0, 0.5, 67),
      note(0, 0.5, 72),
    ]
    const out = filterNotes(raw)
    expect(out.map((n) => [n.startSec, n.midi])).toEqual([
      [0, 72], // 같은 시작이면 높은 음이 먼저
      [0, 67],
      [2, 60],
    ])
  })
  it('경계값(딱 기준)은 남긴다', () => {
    expect(filterNotes([note(0, MIN_NOTE_SECONDS, 60, MIN_CONFIDENCE)])).toHaveLength(1)
  })
})

describe('음원 분석 결과 → 악보용 정보 (audioToInfo)', () => {
  const result = {
    fileName: '노래.mp3'.normalize('NFD'), // 맥의 분리형 한글 이름
    size: 1000,
    durationSec: 30,
    notes: [note(0, 0.5, 60), note(0.5, 0.5, 64), note(1, 1, 67)],
    detectedCount: 9,
    bpm: { value: 120, confidence: 0.4 },
    key: { value: { fifths: -3, mode: 'minor' as const }, confidence: 0.6 },
    backend: 'webgl',
    elapsedMs: 4200,
  }
  const i = audioToInfo(result)

  it('MIDI 파일과 같은 모양이고, 음원 출처임을 표시한다', () => {
    expect(i.source).toBe('audio')
    expect(i.ppq).toBe(480)
    expect(i.fileName).toBe('노래.mp3') // 합쳐진 형태
    expect(i.tracks).toHaveLength(1)
    expect(i.tracks[0]).toMatchObject({
      kind: 'pitched',
      noteCount: 3,
      lowestMidi: 60,
      highestMidi: 67,
      instrumentNumber: 0,
    })
    expect(i.audio).toMatchObject({ detectedCount: 9, backend: 'webgl', bpmConfidence: 0.4, keyConfidence: 0.6 })
  })

  it('템포·조성은 추정값으로 넣고, 박자는 비워서 4/4 기본값을 쓰게 한다', () => {
    expect(i.tempos).toEqual([{ ticks: 0, bpm: 120 }])
    expect(i.timeSignatures).toEqual([])
    expect(i.keySignatures[0]).toMatchObject({ fifths: -3, scale: 'minor', tonic: 'C' })
  })

  it('초를 박(틱)으로 환산한다: 120BPM에서 0.5초 = 4분음표 1박 = 480틱, 1초 = 960틱', () => {
    expect(toNoteEvents(result.notes, 120).map((n) => [n.ticks, n.durationTicks])).toEqual([
      [0, 480],
      [480, 480],
      [960, 960],
    ])
    expect(toNoteEvents(result.notes, 60).map((n) => n.ticks)).toEqual([0, 240, 480]) // 느린 템포에서는 박이 절반만 지났다
    expect(toNoteEvents([note(1, 0.0001, 60)], 120)[0].durationTicks).toBe(1) // 최소 1틱
  })

  it('음표가 하나도 없으면 빈 트랙(empty)이다', () => {
    expect(audioToInfo({ ...result, notes: [] }).tracks[0].kind).toBe('empty')
  })
})

describe('템포에 따른 박 위치 환산 (materializeAudio)', () => {
  const audio = audioToInfo({
    fileName: 'a.wav',
    size: 1,
    durationSec: 10,
    notes: Array.from({ length: 8 }, (_, k) => note(k * 0.5, 0.45, 60 + k)),
    detectedCount: 8,
    bpm: { value: 120, confidence: 0.5 },
    key: { value: { fifths: 0, mode: 'major' as const }, confidence: 0.5 },
    backend: 'cpu',
    elapsedMs: 1,
  })
  const types = (xml: string) => [...xml.matchAll(/<type>(\w+)<\/type>/g)].map((m) => m[1])

  it('MIDI 파일은 그대로 돌려준다', () => {
    const midi = info([track(0, 'x', [[0, 4, 60]])])
    expect(materializeAudio(midi, applySettings(midi))).toBe(midi)
  })

  it('추정 템포(120)에서는 0.5초 간격 음표가 4분음표로 악보가 된다', () => {
    const res = buildInstrumentScore(
      materializeAudio(audio, applySettings(audio, { audioEdit: false })),
      applySettings(audio, { audioEdit: false }),
    )
    const t = types(res.xml).filter((x) => x !== 'whole')
    expect(t.filter((x) => x === 'quarter').length).toBeGreaterThanOrEqual(8)
  })

  it('사용자가 템포를 60으로 고치면 같은 음표가 8분음표로 바뀐다 (박 구조가 템포에 맞게 다시 만들어진다)', () => {
    const s = applySettings(audio, { tempo: 60, audioEdit: false })
    const m = materializeAudio(audio, s)
    expect(m.tempos).toEqual([{ ticks: 0, bpm: 60 }])
    const res = buildInstrumentScore(m, s)
    expect(types(res.xml)).toContain('eighth')
    expect(types(res.xml)).not.toContain('quarter')
    expect(res.xml).toContain('tempo="60"')
  })

  it('피아노 MIDI도 고친 템포로 만든다 (음의 길이가 템포에 맞게 달라진다)', async () => {
    const { Midi } = await import('@tonejs/midi')
    const at = (bpm: number) => new Midi(buildPianoMidi(audio, applySettings(audio, { tempo: bpm })))
    const slow = at(60)
    const fast = at(120)
    expect(slow.header.tempos[0].bpm).toBeCloseTo(60)
    // 같은 초 위치의 음이 느린 템포에서는 틱이 절반
    expect(slow.tracks[0].notes[2].ticks).toBe(fast.tracks[0].notes[2].ticks / 2)
  })
})

describe('조성 추정 (estimateKey)', () => {
  const scale = (tonic: number, steps: number[], count = 4): AudioNote[] =>
    Array.from({ length: count }, () => steps)
      .flat()
      .map((s, i) => note(i * 0.4, 0.4, 60 + ((tonic + s) % 12)))
  const MAJOR = [0, 2, 4, 5, 7, 9, 11]
  const emphasize = (notes: AudioNote[], pcs: number[]) => [
    ...notes,
    ...pcs.flatMap((pc) => Array.from({ length: 6 }, (_, i) => note(40 + i, 1, 60 + pc))),
  ]

  it('C장조 음계는 조표 없음 장조', () => {
    expect(estimateKey(emphasize(scale(0, MAJOR), [0, 4, 7])).value).toEqual({ fifths: 0, mode: 'major' })
  })
  it('E♭장조(조표 ♭3개)를 찾는다', () => {
    const r = estimateKey(emphasize(scale(3, MAJOR), [3, 7, 10]))
    expect(r.value.fifths).toBe(-3)
    expect(r.confidence).toBeGreaterThan(0)
  })
  it('G장조(조표 ♯1개)를 찾는다', () => {
    expect(estimateKey(emphasize(scale(7, MAJOR), [7, 11, 2])).value.fifths).toBe(1)
  })
  it('음표가 없으면 기본값 C장조와 확신도 0', () => {
    expect(estimateKey([])).toEqual({ value: { fifths: 0, mode: 'major' }, confidence: 0 })
  })
})

describe('템포 추정', () => {
  const SR = 22050
  // 음 시작이 또렷한 합성 선율: 4분 2개 + 8분 2개 + ... 를 반복
  function synth(bpm: number, bars = 10): Float32Array {
    const q = 60 / bpm
    const pattern: [number, number, number][] = [
      [0, 1, 60],
      [1, 0.5, 62],
      [1.5, 0.5, 64],
      [2, 1, 65],
      [3, 0.5, 67],
      [3.5, 0.5, 69],
    ]
    const pcm = new Float32Array(Math.ceil(bars * 4 * q * SR + SR))
    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let m = 0; m < bars; m++)
      for (const [b, d, p] of pattern) {
        const n0 = Math.floor((m * 4 + b) * q * SR)
        const f = 440 * 2 ** ((p - 69) / 12)
        for (let i = 0; i < d * q * 0.95 * SR && n0 + i < pcm.length; i++) {
          const tt = i / SR
          pcm[n0 + i] +=
            0.3 *
              Math.min(1, tt / 0.004) *
              Math.exp(-tt * 4) *
              (Math.sin(2 * Math.PI * f * tt) + 0.4 * Math.sin(4 * Math.PI * f * tt)) +
            (rnd() - 0.5) * 0.002
        }
      }
    return pcm
  }

  it.each([76, 82, 90, 100])('파형으로 %i BPM을 ±2 안에서 찾는다', (bpm) => {
    const r = estimateBpmFromAudio(synth(bpm), SR)!
    expect(Math.abs(r.value - bpm)).toBeLessThanOrEqual(2)
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('너무 짧은 음원(4초 미만)은 추정하지 않는다', () => {
    expect(estimateBpmFromAudio(new Float32Array(SR * 3), SR)).toBeNull()
  })

  it('음표 시작 시각만으로도 규칙적인 리듬이면 템포를 찾는다 (보조 수단, 76 BPM 이상)', () => {
    const pattern = [0, 1, 1.5, 2, 3, 3.5] // 마디마다 4분·8분 섞인 리듬
    for (const bpm of [76, 90, 100, 120]) {
      const q = 60 / bpm
      const onsets = Array.from({ length: 12 }, (_, m) => pattern.map((b) => (m * 4 + b) * q)).flat()
      expect(Math.abs(estimateBpmFromNotes(onsets).value - bpm), `${bpm} BPM`).toBeLessThanOrEqual(2)
    }
  })

  it('한계: 느린 템포(60 BPM)는 2배(120)로 읽을 수 있다 — 화면의 템포 입력으로 고친다', () => {
    const pattern = [0, 1, 1.5, 2, 3, 3.5]
    const q = 1 // 60 BPM
    const onsets = Array.from({ length: 12 }, (_, m) => pattern.map((b) => (m * 4 + b) * q)).flat()
    expect(estimateBpmFromNotes(onsets).value).toBe(120)
  })

  it('음표가 너무 적으면 120 BPM 기본값과 확신도 0', () => {
    expect(estimateBpmFromNotes([0, 1])).toEqual({ value: 120, confidence: 0 })
  })
})
