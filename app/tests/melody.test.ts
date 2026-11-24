import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { MELODY_HIGH, MELODY_LOW, MIN_MELODY_NOTES, selectMelody } from '../src/audio/melody'
import { audioToInfo } from '../src/audio/toInfo'
import type { AudioNote } from '../src/midi/types'
import { buildScore } from '../src/score/buildScore'
import { applySettings } from '../src/score/settings'
import { rng } from './helpers'

const n = (startSec: number, durationSec: number, midi: number, velocity = 0.8): AudioNote => ({
  startSec,
  durationSec,
  midi,
  velocity,
})
const pitches = (notes: AudioNote[]) => notes.map((x) => x.midi)

/** 한 줄 선율의 조건: 시작 순서이고, 앞 음이 끝난 뒤에 다음 음이 시작한다 (겹치는 음 없음) */
function expectMonophonic(notes: AudioNote[]) {
  for (let i = 1; i < notes.length; i++) {
    expect(notes[i].startSec, `${i}번째 음이 앞 음보다 먼저 시작`).toBeGreaterThanOrEqual(notes[i - 1].startSec)
    expect(notes[i].startSec, `${i}번째 음이 앞 음과 겹침`).toBeGreaterThanOrEqual(
      notes[i - 1].startSec + notes[i - 1].durationSec - 1e-6,
    )
  }
}

describe('주 멜로디 선택 (selectMelody, 기획서 8.5장 4번)', () => {
  const tune = [64, 67, 69, 67, 64, 62, 60, 62] // 0.5초씩 이어지는 선율

  it('빈 입력이면 빈 결과', () => expect(selectMelody([])).toEqual([]))

  it('이미 한 줄인 선율은 그대로 돌려준다', () => {
    const melody = tune.map((p, i) => n(i * 0.5, 0.5, p))
    const out = selectMelody(melody)
    expect(pitches(out)).toEqual(tune)
    expect(out.map((x) => x.startSec)).toEqual(melody.map((x) => x.startSec))
    expectMonophonic(out)
  })

  it('신뢰도가 낮은 반주(베이스·화음)가 섞여 있어도 선율만 남긴다', () => {
    const melody = tune.map((p, i) => n(i * 0.5, 0.5, p))
    const accompaniment = [
      ...[36, 43, 41, 36].map((p, i) => n(i * 1, 1, p, 0.3)), // 베이스 (음역 밖)
      ...[0, 2, 4, 6].flatMap((b) => [n(b * 0.5, 1, 52, 0.3), n(b * 0.5, 1, 55, 0.3)]), // 선율 아래 화음
    ]
    const out = selectMelody([...accompaniment, ...melody])
    expect(pitches(out)).toEqual(tune)
    expectMonophonic(out)
  })

  it('주선율 음역(C3~G5) 밖의 음은 후보에서 뺀다 (너무 높은 배음, 너무 낮은 음)', () => {
    const melody = tune.map((p, i) => n(i * 0.5, 0.5, p))
    const noise = [n(0, 4, 96), n(1, 1, 100), n(0, 4, 30)] // G5보다 높은 배음, C3보다 낮은 음
    const out = selectMelody([...noise, ...melody])
    expect(pitches(out)).toEqual(tune)
    for (const x of out) {
      expect(x.midi).toBeGreaterThanOrEqual(MELODY_LOW)
      expect(x.midi).toBeLessThanOrEqual(MELODY_HIGH)
    }
  })

  it('옥타브가 갑자기 튄 짧은 음은 앞뒤 음과 이어지도록 옥타브를 맞춘다', () => {
    const melody = tune.map((p, i) => n(i * 0.5, 0.5, i === 3 ? p + 12 : p)) // 4번째 음만 한 옥타브 위로 잘못 인식
    expect(pitches(selectMelody(melody))).toEqual(tune)
  })

  it('두 옥타브 튄 짧은 음도 맞춘다', () => {
    const melody = tune.map((p, i) => n(i * 0.5, 0.4, i === 2 ? p - 24 + 24 + 24 : p)) // 69 → 93은 음역 밖이라 지워진다
    const out = selectMelody(melody)
    expectMonophonic(out)
    expect(out.every((x) => x.midi <= MELODY_HIGH)).toBe(true)
  })

  it('진짜 도약(이후에도 그 높이에 머무는 경우)은 그대로 둔다', () => {
    const leap = [60, 62, 64, 76, 77, 79, 77] // 64 → 76으로 한 옥타브 도약 후 높은 곳에 머문다
    expect(pitches(selectMelody(leap.map((p, i) => n(i * 0.5, 0.5, p))))).toEqual(leap)
  })

  it('긴 음(0.8초 이상)은 튄 음이 아니라 진짜 멜로디로 본다', () => {
    const melody = [n(0, 0.5, 60), n(0.5, 0.5, 62), n(1, 1.0, 74), n(2, 0.5, 62), n(2.5, 0.5, 60)]
    expect(pitches(selectMelody(melody))).toEqual([60, 62, 74, 62, 60])
  })

  it('너무 짧은 잡음 조각은 지운다', () => {
    const melody = tune.map((p, i) => n(i * 0.5, 0.5, p))
    const blips = [n(0.2, 0.03, 80), n(1.1, 0.02, 79)] // 0.08초 미만의 높은 잡음
    expect(pitches(selectMelody([...melody, ...blips]))).toEqual(tune)
  })

  it('같은 높이로 이어지는 음은 하나로 합친다', () => {
    const out = selectMelody([n(0, 0.5, 60), n(0.5, 0.5, 60), n(1, 0.5, 62), n(1.5, 0.5, 64)])
    expect(out[0]).toMatchObject({ midi: 60, startSec: 0 })
    expect(out[0].durationSec).toBeCloseTo(1, 5)
  })

  it('쉼표(소리 없는 구간)는 그대로 비워 둔다', () => {
    const out = selectMelody([n(0, 0.5, 60), n(1.5, 0.5, 62), n(2, 0.5, 64)])
    expect(out[0].startSec + out[0].durationSec).toBeLessThan(out[1].startSec)
  })

  it('같은 신뢰도·길이의 음이 겹치면 먼저 시작한 선율을 따른다 (위쪽 화음이 있어도 높은 음을 따라가지 않는다)', () => {
    const melody = tune.map((p, i) => n(i * 0.5, 0.5, p))
    const above = melody.map((x) => n(x.startSec, x.durationSec, x.midi + 7)) // 5도 위의 화음 음
    expect(pitches(selectMelody([...melody, ...above]))).toEqual(tune)
  })

  it('2단계: 신뢰도×길이 점수가 높은 음이 이긴다 (짧은 반주 잔음은 걸러진다)', () => {
    const long = n(0, 2, 60, 0.7) // 점수 1.4
    const shortLoud = n(0.5, 0.3, 72, 0.9) // 점수 0.27: 더 높고 신뢰도도 높지만 짧다
    expect(pitches(selectMelody([long, shortLoud]))).toEqual([60])
  })

  it('한계: 선율보다 길고 확실한 반주 음이 있으면 그 음을 따라간다', () => {
    const melody = tune.map((p, i) => n(i * 0.5, 0.5, p, 0.5))
    const pad = [n(0, 4, 55, 0.9)] // 4초 동안 이어지는 확실한 반주(패드) 음
    expect(selectMelody([...melody, ...pad]).every((x) => x.midi === 55)).toBe(true)
  })

  it('3단계: 직전 음보다 1옥타브 튄 짧은 음은 옥타브를 맞추고, 뒤 음들로 번지지 않는다', () => {
    const out = selectMelody([n(0, 0.5, 60), n(0.5, 0.5, 72), n(1, 0.5, 62), n(1.5, 0.5, 64)])
    expect(pitches(out)).toEqual([60, 62, 64]) // 72는 60과 같은 높이로 맞춰져 앞 음에 합쳐진다
  })

  it('4단계: 같은 높이가 50ms 이내 틈으로 이어지면 하나로 합친다 (더 벌어지면 둘로 둔다)', () => {
    const near = selectMelody([n(0, 0.5, 60), n(0.54, 0.5, 60), n(1.2, 0.5, 62), n(1.7, 0.5, 64)])
    expect(near[0].durationSec).toBeCloseTo(1.04, 5)
    const far = selectMelody([n(0, 0.5, 60), n(0.6, 0.5, 60), n(1.2, 0.5, 62), n(1.7, 0.5, 64)])
    expect(pitches(far).slice(0, 2)).toEqual([60, 60])
  })

  it('무작위로 섞인 여러 음에서도 항상 겹치는 음 없는 한 줄이고 음역 안이다', () => {
    const r = rng(21)
    for (let trial = 0; trial < 60; trial++) {
      const notes = Array.from({ length: 80 }, () => n(r() * 20, 0.05 + r() * 2, 20 + Math.floor(r() * 90), r()))
      const out = selectMelody(notes)
      expectMonophonic(out)
      for (const x of out) {
        expect(x.midi).toBeGreaterThanOrEqual(MELODY_LOW)
        expect(x.midi).toBeLessThanOrEqual(MELODY_HIGH)
        expect(x.durationSec).toBeGreaterThan(0)
      }
    }
  })

  it('음역 안에 후보가 없으면 빈 결과', () => {
    expect(selectMelody([n(0, 1, 100), n(1, 1, 30)])).toEqual([])
  })

  it('"멜로디를 찾지 못함" 기준은 3음 미만', () => expect(MIN_MELODY_NOTES).toBe(3))
})

describe('음원 분석 결과 악보 (한 단, 파트 이름 Melody)', () => {
  const melody = [64, 67, 69, 67, 64, 62, 60, 62, 64, 67, 72, 71].map((p, i) => n(i * 0.5, 0.45, p))
  const mix = [...melody, ...[36, 43, 41, 36].map((p, i) => n(i * 1.5, 1.4, p)), ...[48, 52].map((p) => n(0, 3, p))]
  const info = audioToInfo({
    fileName: '곡.wav',
    size: 1,
    durationSec: 6,
    notes: selectMelody(mix),
    detectedCount: mix.length,
    bpm: { value: 120, confidence: 0.5 },
    key: { value: { fifths: 0, mode: 'major' as const }, confidence: 0.5 },
    backend: 'webgl',
    elapsedMs: 1000,
  })
  const parse = (xml: string) =>
    new DOMParser().parseFromString(xml, 'application/xml').documentElement as unknown as Element
  const count = (el: Element, tag: string) => (el.getElementsByTagName(tag) as unknown as ArrayLike<Element>).length

  {
    it('항상 높은음자리표 한 단, 화음·겹침 없는 한 줄이다 (파트 이름 Melody)', () => {
      const res = buildScore(info, applySettings(info))
      const doc = parse(res.xml)
      expect(count(doc, 'score-part')).toBe(1)
      expect(doc.getElementsByTagName('part-name')[0].textContent).toBe('Melody')
      expect(count(doc, 'staves')).toBe(0) // 보표는 하나
      expect(doc.getElementsByTagName('sign')[0].textContent).toBe('G')
      expect(count(doc, 'chord')).toBe(0) // 동시에 두 음 이상 없음
      expect(count(doc, 'backup')).toBe(0) // 성부는 하나
      expect(res.report.parts).toHaveLength(1)
    })
  }

  it('낮은 음역의 멜로디여도 높은음자리표를 쓴다 (기획서: 높은음자리표 한 단)', () => {
    const low = audioToInfo({
      ...{
        fileName: 'b.wav',
        size: 1,
        durationSec: 3,
        detectedCount: 4,
        bpm: { value: 100, confidence: 0.5 },
        key: { value: { fifths: 0, mode: 'major' as const }, confidence: 0.5 },
        backend: 'cpu',
        elapsedMs: 1,
      },
      notes: [n(0, 0.5, 48), n(0.6, 0.5, 50), n(1.2, 0.5, 52), n(1.8, 0.5, 50)],
    })
    const doc = parse(buildScore(low, applySettings(low)).xml)
    expect(doc.getElementsByTagName('sign')[0].textContent).toBe('G')
  })
})

describe('아주 가까운 음도 악보에서 겹치지 않는다 (실제 음원에서 발견한 문제의 회귀 시험)', () => {
  // 120BPM에서 16분음표 한 칸 = 0.125초. 이보다 짧은 간격의 음이 이어지면 같은 칸에 놓일 수 있다.
  const fast = Array.from({ length: 40 }, (_, i) => n(i * 0.07, 0.065, 60 + (i % 7)))
  const res = (() => {
    const melody = selectMelody(fast.map((x) => ({ ...x, durationSec: 0.09 })))
    const info = audioToInfo({
      fileName: 'f.wav',
      size: 1,
      durationSec: 4,
      notes: melody,
      detectedCount: fast.length,
      bpm: { value: 120, confidence: 0.5 },
      key: { value: { fifths: 0, mode: 'major' as const }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })
    return buildScore(info, applySettings(info))
  })()
  it('화음(chord)도 2성부(backup)도 만들지 않는다', () => {
    expect(res.xml).not.toContain('<chord/>')
    expect(res.xml).not.toContain('<backup>')
  })
})
