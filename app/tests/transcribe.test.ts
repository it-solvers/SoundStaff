import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import {
  MERGE_GAP_SECONDS,
  dropBackgroundNotes,
  dropOctaveHarmonics,
  importance,
  markMinorNotes,
  mergeRepeatedNotes,
} from '../src/audio/notes'
import { audioTracks, audioToInfo, HAND_SPLIT } from '../src/audio/toInfo'
import {
  decompose,
  fitMinorToVoices,
  layoutTrack,
  MAIN_VOICES,
  selectMainNotes,
  fitToVoices,
} from '../src/midi/measures'
import {
  buildMeasureGrid,
  chordifyByBeat,
  chordifyByOnset,
  snapToBeatOrEighth,
  simplifyToChords,
  tidyForEditing,
  type QNote,
} from '../src/midi/quantize'
import type { AudioNote } from '../src/midi/types'
import { buildScore } from '../src/score/buildScore'
import { materializeAudio } from '../src/score/audioInfo'
import { applySettings } from '../src/score/settings'
import { buildTimeline } from '../src/play/timeline'
import { rng, soundingCoverage, transcriptionCoverage } from './helpers'

const q = (start: number, end: number, midi: number, velocity = 0.7): QNote => ({ start, end, midi, velocity })
const an = (startSec: number, durationSec: number, midi: number, velocity = 0.7): AudioNote => ({
  startSec,
  durationSec,
  midi,
  velocity,
})
const colored = (xml: string) => (xml.match(/<note color="#8a8a8a"/g) ?? []).length
const parse = (xml: string) =>
  new DOMParser().parseFromString(xml, 'application/xml').documentElement as unknown as Element
const count = (el: Element, tag: string) => (el.getElementsByTagName(tag) as unknown as ArrayLike<Element>).length
const overlaps = (notes: QNote[]) =>
  notes.some((a) => notes.some((b) => a !== b && a.start < b.end && b.start < a.end && a.start !== b.start))

describe('같은 때 울리는 음을 화음으로 정리 (simplifyToChords)', () => {
  it('빈 입력', () => expect(simplifyToChords([])).toEqual([]))

  it('같은 시작의 음은 한 화음이 되고 길이가 같아진다', () => {
    const out = simplifyToChords([q(0, 4, 60), q(0, 8, 64), q(0, 4, 67)])
    expect(out.map((n) => n.midi).sort()).toEqual([60, 64, 67])
    expect(new Set(out.map((n) => n.end)).size).toBe(1)
    expect(out[0].end).toBe(8) // 가장 긴 음 기준
  })

  it('화음은 다음 화음이 시작하면 끊긴다 (겹쳐 이어지는 음을 잘라 한 성부로)', () => {
    const out = simplifyToChords([q(0, 16, 60), q(4, 8, 62), q(8, 12, 64)])
    expect(out.find((n) => n.midi === 60)).toMatchObject({ start: 0, end: 4 })
    expect(out.find((n) => n.midi === 62)).toMatchObject({ start: 4, end: 8 })
    expect(overlaps(out)).toBe(false)
  })

  it('다음 음 시작 전에 끝나는 음은 그 끝을 지킨다 (사이는 쉼표)', () => {
    const out = simplifyToChords([q(0, 2, 60), q(8, 12, 62)])
    expect(out.find((n) => n.midi === 60)).toMatchObject({ start: 0, end: 2 })
  })

  it('5음 이상이면 가장 낮은 음·가장 높은 음과 세기가 센 음을 남겨 4음으로 줄인다', () => {
    const group = [q(0, 4, 40, 0.1), q(0, 4, 50, 0.9), q(0, 4, 60, 0.2), q(0, 4, 70, 0.8), q(0, 4, 80, 0.3)]
    const out = simplifyToChords(group)
    expect(out).toHaveLength(4)
    expect(out.map((n) => n.midi).sort((a, b) => a - b)).toEqual([40, 50, 70, 80]) // 바깥 음 + 센 음 둘
  })

  it('같은 높이가 같은 시작에 둘이면 하나로 합친다', () => {
    expect(simplifyToChords([q(0, 4, 60, 0.3), q(0, 8, 60, 0.5)])).toEqual([q(0, 8, 60, 0.5)])
  })

  it('무작위로 빽빽한 음에서도 항상 겹치지 않고, 한 화음 4음 이하이고, 모든 시작 시각이 남는다', () => {
    const r = rng(5)
    for (let trial = 0; trial < 50; trial++) {
      const notes = Array.from({ length: 120 }, () => {
        const start = Math.floor(r() * 60)
        return q(start, start + 1 + Math.floor(r() * 20), 40 + Math.floor(r() * 48), r())
      })
      const out = simplifyToChords(notes)
      expect(overlaps(out)).toBe(false)
      const byStart = new Map<number, number>()
      for (const n of out) byStart.set(n.start, (byStart.get(n.start) ?? 0) + 1)
      expect(Math.max(...byStart.values())).toBeLessThanOrEqual(4)
      expect(new Set(out.map((n) => n.start))).toEqual(new Set(notes.map((n) => n.start)))
      for (const n of out) expect(n.end).toBeGreaterThan(n.start)
    }
  })
})

describe('음원 분석의 단 만들기 (audioTracks)', () => {
  const high = [an(0, 1, 72), an(1, 1, 64)]
  const low = [an(0, 1, 48), an(1, 1, 40)]

  it('들리는 대로: 가온 도(60) 이상은 오른손(높은음자리표), 미만은 왼손(낮은음자리표)', () => {
    const tr = audioTracks({ notes: [], allNotes: [...high, ...low] }, 'full', 120)
    expect(tr.map((t) => [t.index, t.clef, t.noteCount])).toEqual([
      [0, 'G', 2],
      [1, 'F', 2],
    ])
    expect(tr.every((t) => t.chords)).toBe(true)
    expect(HAND_SPLIT).toBe(60)
  })

  it('가온 도 자체는 오른손', () => {
    const tr = audioTracks({ notes: [], allNotes: [an(0, 1, 60), an(1, 1, 59)] }, 'full', 120)
    expect(tr[0].notes[0].midi).toBe(60)
    expect(tr[1].notes[0].midi).toBe(59)
  })

  it('한쪽에만 음이 있으면 그 단만 만들고 이름은 Piano, 번호는 그대로(오른손 0 / 왼손 1)', () => {
    const onlyHigh = audioTracks({ notes: [], allNotes: high }, 'full', 120)
    expect(onlyHigh.map((t) => [t.index, t.name])).toEqual([[0, 'Piano']])
    const onlyLow = audioTracks({ notes: [], allNotes: low }, 'full', 120)
    expect(onlyLow.map((t) => [t.index, t.name, t.clef])).toEqual([[1, 'Piano', 'F']])
  })

  it('멜로디만: 한 줄 선율을 높은음자리표 한 단으로 (화음 정리 없음)', () => {
    const tr = audioTracks({ notes: high, allNotes: [...high, ...low] }, 'melody', 120)
    expect(tr).toHaveLength(1)
    expect(tr[0]).toMatchObject({ name: 'Melody', clef: 'G', noteCount: 2 })
    expect(tr[0].chords).toBeUndefined()
  })

  it('템포를 바꾸면 틱이 달라진다 (초 단위로 보관했다가 지금 템포로 환산)', () => {
    const fast = audioTracks({ notes: [], allNotes: [an(1, 1, 72)] }, 'full', 120)[0].notes[0]
    const slow = audioTracks({ notes: [], allNotes: [an(1, 1, 72)] }, 'full', 60)[0].notes[0]
    expect(fast.ticks).toBe(slow.ticks * 2)
  })
})

describe('들리는 대로 악보 (기본 방식)', () => {
  const mix = (): AudioNote[] => {
    const notes: AudioNote[] = []
    for (let i = 0; i < 16; i++) notes.push(an(i * 0.5, 0.5, 72 + (i % 5))) // 높은 선율
    for (let i = 0; i < 4; i++) notes.push(an(i * 2, 2, 48), an(i * 2, 2, 52), an(i * 2, 2, 55)) // 낮은 화음
    return notes
  }
  const info = () =>
    audioToInfo({
      fileName: 'mix.wav',
      size: 1,
      durationSec: 8,
      notes: mix().filter((n) => n.midi >= 72),
      allNotes: mix(),
      detectedCount: mix().length,
      bpm: { value: 120, confidence: 0.5 },
      key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })

  it('설정을 따로 주지 않으면 들리는 대로 방식이다', () => expect(applySettings(info()).audioMode).toBe('full'))

  it('기본: 한 파트 "Piano"에 보표 2개(높은음자리표 + 낮은음자리표)인 피아노 대보표다', () => {
    const res = buildScore(info(), applySettings(info()))
    const doc = parse(res.xml)
    expect(count(doc, 'score-part')).toBe(1)
    expect(
      Array.from(doc.getElementsByTagName('part-name') as unknown as ArrayLike<Element>).map((e) => e.textContent),
    ).toEqual(['Piano'])
    expect(doc.getElementsByTagName('staves')[0].textContent).toBe('2')
    expect(
      Array.from(doc.getElementsByTagName('sign') as unknown as ArrayLike<Element>).map((e) => e.textContent),
    ).toEqual(['G', 'F'])
    expect(doc.getElementsByTagName('part-symbol')[0].textContent).toBe('brace')
  })

  it('정리를 꺼도 피아노 한 파트의 오른손·왼손 두 보표다', () => {
    const doc = parse(buildScore(info(), applySettings(info(), { audioSimplify: false })).xml)
    expect(count(doc, 'score-part')).toBe(1)
    expect(doc.getElementsByTagName('staves')[0].textContent).toBe('2')
  })

  it('왼손 화음은 화음(chord)으로 적히고, 한 보표는 4성부 이하(돋보이기를 끄면 1성부)다', () => {
    const res = buildScore(info(), applySettings(info()))
    expect(count(parse(res.xml), 'chord')).toBeGreaterThan(0)
    expect(res.report.parts[0].maxVoices).toBeLessThanOrEqual(4)
    expect(buildScore(info(), applySettings(info(), { audioEmphasis: false })).report.parts[0].maxVoices).toBe(1)
  })

  it('찾은 음이 모두 악보에 있다 (정리로 빠지는 음은 없다: 이 곡은 4음 이하)', () => {
    const res = buildScore(info(), applySettings(info(), { audioMerge: false, audioEdit: false }))
    const total = res.report.parts.reduce((a, p) => a + p.noteCount, 0)
    expect(total).toBe(mix().length)
  })

  it('멜로디만으로 바꾸면 한 단·높은음자리표·화음 없음으로 바뀐다', () => {
    const doc = parse(buildScore(info(), applySettings(info(), { audioMode: 'melody' })).xml)
    expect(count(doc, 'score-part')).toBe(1)
    expect(count(doc, 'chord')).toBe(0)
  })

  it('방식에 따라 materializeAudio가 다른 단을 만든다', () => {
    expect(materializeAudio(info(), applySettings(info())).tracks).toHaveLength(2)
    expect(materializeAudio(info(), applySettings(info(), { audioMode: 'melody' })).tracks).toHaveLength(1)
  })

  it('아주 빽빽한 무작위 음에서도 오류 없이 만들어지고 한 보표는 최대 4성부(주된 음 3 + 흐린 음 1)이고 성부 초과 알림이 없다. 돋보이기를 끄면 1성부다', () => {
    const r = rng(9)
    const dense = Array.from({ length: 600 }, () =>
      an(r() * 30, 0.05 + r() * 1.5, 36 + Math.floor(r() * 60), 0.3 + r() * 0.7),
    )
    const i = audioToInfo({
      fileName: 'd.wav',
      size: 1,
      durationSec: 30,
      notes: dense.slice(0, 50),
      allNotes: dense,
      detectedCount: dense.length,
      bpm: { value: 100, confidence: 0.5 },
      key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })
    const res = buildScore(i, applySettings(i))
    expect(res.report.parts[0].maxVoices).toBeLessThanOrEqual(4)
    expect(res.report.warnings.some((w) => w.includes('성부가 4개를 넘어'))).toBe(false)
    expect(res.xml).not.toMatch(/undefined|NaN/)
    expect(buildScore(i, applySettings(i, { audioEmphasis: false })).report.parts[0].maxVoices).toBe(1)
    expect(res.report.measureCount).toBeGreaterThan(5)
  })
})

describe('읽기 쉽게 정리를 켜면 뺀 음을 알린다', () => {
  const mk = (all: AudioNote[]) =>
    audioToInfo({
      fileName: 'w.wav',
      size: 1,
      durationSec: 4,
      notes: all.slice(0, 3),
      allNotes: all,
      detectedCount: all.length,
      bpm: { value: 120, confidence: 0.5 },
      key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })
  it('한 번에 4음을 넘으면 몇 개를 뺐는지 알림에 나온다', () => {
    const cluster = [
      an(0, 1, 72),
      an(0, 1, 74),
      an(0, 1, 76),
      an(0, 1, 77),
      an(0, 1, 79),
      an(0, 1, 81),
      an(1, 1, 72),
      an(2, 1, 74),
    ]
    const res = buildScore(
      mk(cluster),
      applySettings(mk(cluster), { audioSimplify: true, audioMerge: false, audioEmphasis: false, audioEdit: false }),
    )
    expect(res.report.warnings.some((w) => w.includes('2개') && w.includes('전체 8개'))).toBe(true)
  })
  it('빠진 음이 없으면 알림도 없다', () => {
    const calm = [an(0, 1, 72), an(1, 1, 74), an(2, 1, 76), an(3, 1, 77)]
    const res = buildScore(
      mk(calm),
      applySettings(mk(calm), { audioSimplify: true, audioMerge: false, audioEmphasis: false }),
    )
    expect(res.report.warnings.some((w) => w.includes('뺐습니다'))).toBe(false)
  })
})

describe('알림의 "뺀 음" 개수는 실제 악보와 정확히 맞는다', () => {
  it('전체 음 − 알림의 뺀 음 = 악보에 적힌 음의 수 (붙임줄로 이어진 음은 한 음)', () => {
    const r = rng(17)
    for (let trial = 0; trial < 12; trial++) {
      const notes = Array.from({ length: 200 }, () =>
        an(r() * 20, 0.04 + r() * 2.2, 36 + Math.floor(r() * 60), 0.3 + r() * 0.7),
      )
      const i = audioToInfo({
        fileName: 'c.wav',
        size: 1,
        durationSec: 20,
        notes: notes.slice(0, 30),
        allNotes: notes,
        detectedCount: notes.length,
        bpm: { value: 90 + trial * 7, confidence: 0.5 },
        key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
        backend: 'cpu',
        elapsedMs: 1,
      })
      const res = buildScore(i, applySettings(i, { audioMerge: false, audioEdit: false }))
      const m = /음 (\d+)개\(전체 (\d+)개 중\)/.exec(res.report.warnings.join(' '))
      const removed = m ? Number(m[1]) : 0
      const inScore = (res.xml.match(/<pitch>/g) ?? []).length - (res.xml.match(/<tie type="stop"\/>/g) ?? []).length
      expect(notes.length - removed, `시도 ${trial}`).toBe(inScore)
    }
  })
})

describe('찾은 음은 100% 악보에 옮겨진다 (이어 붙이기를 끄면 시작 위치까지, 켜면 울리는 구간까지)', () => {
  const mkInfo = (all: AudioNote[], bpm: number) =>
    audioToInfo({
      fileName: 'z.wav',
      size: 1,
      durationSec: 40,
      notes: all.slice(0, 30),
      allNotes: all,
      detectedCount: all.length,
      bpm: { value: bpm, confidence: 0.5 },
      key: { value: { fifths: -3, mode: 'major' }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })
  const coverage = (all: AudioNote[], bpm: number, over = {}) => {
    const info = mkInfo(all, bpm)
    const res = buildScore(info, applySettings(info, { audioMerge: false, audioSimplify: false, ...over })) // 시작 위치 기준 100%는 AI가 나눈 그대로, 정리 없이 적을 때의 기준
    return { res, ...transcriptionCoverage(all, buildTimeline(res.model).notes, bpm) }
  }

  it('설정을 따로 주지 않으면 읽기 쉽게 정리한다 (피아노 대보표)', () =>
    expect(applySettings(mkInfo([an(0, 1, 60)], 100)).audioSimplify).toBe(true))

  it('무작위로 아주 빽빽하게 겹친 음 12가지: 보표는 항상 두 개이고, 빠진 음이 있으면 알린다', () => {
    const r = rng(23)
    for (let trial = 0; trial < 12; trial++) {
      const notes = Array.from({ length: 400 }, () =>
        an(r() * 25, 0.04 + r() * 3, 30 + Math.floor(r() * 70), 0.3 + r() * 0.7),
      )
      const c = coverage(notes, 80 + trial * 9)
      expect(c.res.model.parts, `시도 ${trial}`).toHaveLength(1)
      expect(c.res.model.parts[0].staves).toHaveLength(2)
      expect(c.res.report.parts[0].maxVoices).toBeLessThanOrEqual(4)
      expect(c.res.report.warnings.some((w) => w.includes('약한 것부터'))).toBe(true)
      expect(c.res.report.warnings.some((w) => w.includes('성부가 4개를 넘어'))).toBe(false)
    }
  })

  it('길게 이어지는 반주 음 위에서 짧은 음이 움직여도 모두 옮겨진다 (짧은 음이 잘리는 일 없음)', () => {
    const pad = [an(0, 8, 48), an(0, 8, 55), an(0, 8, 64)] // 8초 동안 이어지는 화음
    const run = Array.from({ length: 24 }, (_, i) => an(i * 0.3, 0.28, 72 + (i % 7))) // 그 위의 빠른 선율
    const c = coverage([...pad, ...run], 100)
    expect(c.matched).toBe(c.total)
  })

  it('긴 음이 짧은 음 아래에서 이어지는 시간은 악보에서도 유지된다 (끊기지 않는다)', () => {
    const info = mkInfo([an(0, 4, 48), ...Array.from({ length: 8 }, (_, i) => an(i * 0.5, 0.45, 72))], 120)
    const tl = buildTimeline(buildScore(info, applySettings(info)).model)
    const low = tl.notes.find((n) => n.midi === 48)!
    expect(low.duration).toBeGreaterThan(3.5) // 4초를 크게 벗어나지 않는다
  })

  it('읽기 쉽게 정리를 켜면 일부 음이 빠질 수 있고, 그 개수는 알림으로 알려 준다 (끄면 0건)', () => {
    // 한 번에 6음이 울리는 화음 24개 (4음 제한을 넘는다)
    const notes = Array.from({ length: 24 }, (_, i) => [0, 2, 4, 5, 7, 9].map((k) => an(i * 0.6, 0.55, 60 + k))).flat()
    const off = coverage(notes, 100)
    const on = coverage(notes, 100, { audioSimplify: true })
    expect(off.matched).toBe(off.total)
    expect(on.matched).toBeLessThan(on.total)
    expect(on.res.report.warnings.some((w) => w.includes('뺐습니다'))).toBe(true)
  })
})

describe('같은 높이로 이어진 음을 하나로 (mergeRepeatedNotes)', () => {
  it('붙어 있는 같은 높이의 음은 하나의 긴 음이 된다', () => {
    const out = mergeRepeatedNotes([an(0, 1, 60), an(1, 1, 60), an(2, 1, 60)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ startSec: 0, midi: 60 })
    expect(out[0].durationSec).toBeCloseTo(3, 6)
  })
  it('100ms 이내의 작은 틈도 이어 붙이고(떨림으로 끊긴 조각), 그보다 벌어지면 따로 둔다', () => {
    expect(MERGE_GAP_SECONDS).toBe(0.1)
    expect(mergeRepeatedNotes([an(0, 1, 60), an(1.09, 1, 60)])).toHaveLength(1)
    expect(mergeRepeatedNotes([an(0, 1, 60), an(1.12, 1, 60)])).toHaveLength(2)
  })
  it('겹친 같은 높이의 음도 하나로 합치고 가장 늦게 끝나는 쪽까지 늘린다', () => {
    const out = mergeRepeatedNotes([an(0, 3, 60), an(1, 1, 60)]) // 안에 포함된 음
    expect(out).toHaveLength(1)
    expect(out[0].durationSec).toBeCloseTo(3, 6)
  })
  it('다른 높이는 서로 합치지 않는다', () => {
    expect(mergeRepeatedNotes([an(0, 1, 60), an(1, 1, 62), an(2, 1, 60)])).toHaveLength(3)
  })
  it('합친 음의 세기는 센 쪽, 결과는 시작 순서(같은 시작이면 높은 음 먼저)다', () => {
    const out = mergeRepeatedNotes([an(0, 1, 60, 0.4), an(1, 1, 60, 0.9), an(0, 1, 64, 0.5)])
    expect(out.map((n) => n.midi)).toEqual([64, 60])
    expect(out[1].velocity).toBe(0.9)
  })
  it('빈 입력, 원본은 바뀌지 않는다', () => {
    expect(mergeRepeatedNotes([])).toEqual([])
    const src = [an(0, 1, 60), an(1, 1, 60)]
    mergeRepeatedNotes(src)
    expect(src[0].durationSec).toBe(1)
  })
  it('무작위 입력에서도 같은 높이의 결과 음은 서로 병합 간격보다 떨어져 있고, 울리는 구간은 하나도 줄지 않는다', () => {
    const r = rng(41)
    for (let trial = 0; trial < 30; trial++) {
      const notes = Array.from({ length: 150 }, () => an(r() * 20, 0.05 + r() * 1.5, 40 + Math.floor(r() * 12)))
      const out = mergeRepeatedNotes(notes)
      const byPitch = new Map<number, AudioNote[]>()
      for (const n of out) (byPitch.get(n.midi) ?? byPitch.set(n.midi, []).get(n.midi)!).push(n)
      for (const list of byPitch.values()) {
        list.sort((a, b) => a.startSec - b.startSec)
        for (let i = 1; i < list.length; i++)
          expect(list[i].startSec - (list[i - 1].startSec + list[i - 1].durationSec)).toBeGreaterThan(
            MERGE_GAP_SECONDS - 1e-9,
          )
      }
      for (const n of notes)
        expect(
          out.some(
            (m) =>
              m.midi === n.midi &&
              m.startSec <= n.startSec + 1e-9 &&
              m.startSec + m.durationSec >= n.startSec + n.durationSec - 1e-9,
          ),
        ).toBe(true)
    }
  })
})

describe('악보에서 이어 붙이기 (기본 켬)', () => {
  const repeated = [...Array.from({ length: 8 }, (_, i) => an(i * 0.5, 0.5, 72)), an(0, 4, 48)] // 8번 붙어 있는 같은 높이 + 긴 낮은 음
  const mk = (all: AudioNote[]) =>
    audioToInfo({
      fileName: 'r.wav',
      size: 1,
      durationSec: 4,
      notes: all.slice(0, 3),
      allNotes: all,
      detectedCount: all.length,
      bpm: { value: 120, confidence: 0.5 },
      key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })

  it('설정을 따로 주지 않으면 이어 붙인다', () => expect(applySettings(mk(repeated)).audioMerge).toBe(true))

  it('붙어 있는 같은 음 8개가 하나의 긴 음표(붙임줄)로 적힌다', () => {
    const res = buildScore(mk(repeated), applySettings(mk(repeated)))
    const tl = buildTimeline(res.model)
    const high = tl.notes.filter((n) => n.midi === 72)
    expect(high).toHaveLength(1)
    expect(high[0].duration).toBeCloseTo(4, 1)
  })

  it('끄면 AI가 나눈 그대로 8개로 적힌다', () => {
    const res = buildScore(mk(repeated), applySettings(mk(repeated), { audioMerge: false, audioEdit: false }))
    expect(buildTimeline(res.model).notes.filter((n) => n.midi === 72)).toHaveLength(8)
  })

  it('합친 개수가 알림에 나온다 (8개 → 1개이므로 7개)', () => {
    const res = buildScore(mk(repeated), applySettings(mk(repeated)))
    expect(res.report.warnings.some((w) => w.includes('이어진 음 7개') && w.includes('9개 중'))).toBe(true)
    const off = buildScore(mk(repeated), applySettings(mk(repeated), { audioMerge: false }))
    expect(off.report.warnings.some((w) => w.includes('이어 붙여'))).toBe(false)
  })

  it('음표 수가 줄어든다 (악보가 덜 쪼개진다)', () => {
    const on = buildScore(mk(repeated), applySettings(mk(repeated), { audioEdit: false })).report.parts.reduce(
      (a, p) => a + p.noteCount,
      0,
    )
    const off = buildScore(
      mk(repeated),
      applySettings(mk(repeated), { audioMerge: false, audioEdit: false }),
    ).report.parts.reduce((a, p) => a + p.noteCount, 0)
    expect(on).toBe(2)
    expect(off).toBe(9)
  })

  it('멜로디만 방식에는 영향이 없다 (알림 없음)', () => {
    const res = buildScore(mk(repeated), applySettings(mk(repeated), { audioMode: 'melody' }))
    expect(res.report.warnings.some((w) => w.includes('이어 붙여'))).toBe(false)
  })

  it('이어 붙여도 알리고 뺀 음 말고는 찾은 음의 울리는 구간이 악보에 있다 (무작위 12가지, 같은 높이 · 시작 오차 1칸)', () => {
    const r = rng(53)
    for (let trial = 0; trial < 12; trial++) {
      const notes = Array.from({ length: 140 }, () =>
        an(r() * 30, 0.1 + r() * 0.8, 40 + Math.floor(r() * 40), 0.3 + r() * 0.7),
      )
      const info = mk(notes)
      const bpm = 90 + trial * 6
      info.tempos = [{ ticks: 0, bpm }]
      const res = buildScore(info, applySettings(info, { audioSimplify: false }))
      const c = soundingCoverage(notes, buildTimeline(res.model).notes, bpm)
      const dropped = Number(res.report.warnings.join(' ').match(/겹친 음 (\d+)개/)?.[1] ?? 0) // 두 보표에 담지 못해 알리고 뺀 음
      expect(c.total - c.matched, `시도 ${trial}: ${JSON.stringify(c.missing.slice(0, 3))}`).toBeLessThanOrEqual(
        dropped,
      )
    }
  })
})

describe('한 손에 담기지 않는 음 (fitToVoices)', () => {
  const grid = buildMeasureGrid([{ ticks: 0, numerator: 4, denominator: 4 }], 480, 200)
  const dense = (seed: number, n = 160): QNote[] => {
    const r = rng(seed)
    return Array.from({ length: n }, () => {
      const start = Math.floor(r() * 120)
      return { ...q(start, start + 1 + Math.floor(r() * 30), 50 + Math.floor(r() * 30)), velocity: r() }
    })
  }

  it('4성부에 담기면 하나도 빼지 않는다', () => {
    const src = [q(0, 8, 48), q(0, 4, 60), q(4, 8, 62), q(0, 8, 67)]
    expect(fitToVoices(src)).toEqual({ notes: src, dropped: 0 })
  })

  it('남긴 음은 길이를 바꾸거나 합치지 않고 4성부 이하로 적힌다', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const src = dense(seed)
      const fit = fitToVoices(src)
      expect(fit.dropped).toBeGreaterThan(0)
      expect(fit.notes.length + fit.dropped).toBe(src.length)
      for (const n of fit.notes) expect(src).toContain(n)
      const lay = layoutTrack(fit.notes, grid.measures, { legatoTrim: false })
      expect(lay.warnings, `시드 ${seed}`).toEqual([])
      expect(Math.max(...lay.measures.map((v) => v.length))).toBeLessThanOrEqual(4)
    }
  })

  it('자리가 모자라면 크고 긴 음을 남기고 약한 음을 뺀다', () => {
    const strong = [60, 62, 64, 65].map((m, i) => ({ ...q(i, 16 + i, m), velocity: 0.9 }))
    const weak = { ...q(4, 6, 72), velocity: 0.2 }
    expect(fitToVoices([...strong, weak]).notes).toEqual(strong)
  })
})

describe('주된 음 돋보이기: 작고 짧은 음은 회색 (markMinorNotes)', () => {
  const sample = () => [
    an(0, 2, 60, 0.9),
    an(1, 1.5, 64, 0.8),
    an(2, 1, 67, 0.7), // 크고 긴 음
    an(0.2, 0.1, 72, 0.3),
    an(0.5, 0.12, 74, 0.3),
    an(0.9, 0.1, 76, 0.35),
    an(1.3, 0.12, 71, 0.3), // 작고 짧은 음
    an(3, 0.9, 62, 0.6),
    an(4, 0.8, 65, 0.55),
  ]
  it('중요도 = 세기 × √길이, 큰 음일수록 크다', () => {
    expect(importance(an(0, 4, 60, 0.5))).toBeCloseTo(1, 6)
    expect(importance(an(0, 1, 60, 0.9))).toBeGreaterThan(importance(an(0, 1, 60, 0.3)))
    expect(importance(an(0, 4, 60, 0.5))).toBeGreaterThan(importance(an(0, 1, 60, 0.5)))
  })
  it('작고 짧은 음만 덜 주된 음이 되고, 크고 긴 음은 하나도 흐려지지 않는다', () => {
    const out = markMinorNotes(sample())
    for (const n of out.filter((x) => x.velocity <= 0.35)) expect(n.minor).toBe(true)
    for (const n of out.filter((x) => x.velocity >= 0.7)) expect(n.minor).toBe(false)
  })
  it('아래쪽 약 40%가 덜 주된 음이다 (음은 지우지 않고 표시만)', () => {
    const src = sample()
    const out = markMinorNotes(src)
    expect(out).toHaveLength(src.length)
    const share = out.filter((n) => n.minor).length / out.length
    expect(share).toBeGreaterThanOrEqual(0.3)
    expect(share).toBeLessThanOrEqual(0.5)
  })
  it('음이 5개 미만이면 표시하지 않는다', () => {
    expect(markMinorNotes([an(0, 1, 60), an(1, 1, 62)]).every((n) => !n.minor)).toBe(true)
  })
  it('원본을 바꾸지 않는다', () => {
    const src = sample()
    markMinorNotes(src)
    expect(src.every((n) => n.minor === undefined)).toBe(true)
  })
})

describe('악보에서 덜 주된 음은 회색(color 속성)으로 그려진다', () => {
  const notes = (): AudioNote[] => [
    ...Array.from({ length: 12 }, (_, i) => an(i * 0.5, 0.45, 72 + (i % 5), 0.85)), // 크고 긴 음(오른손)
    ...Array.from({ length: 12 }, (_, i) => an(i * 0.5 + 0.2, 0.08, 80 + (i % 3), 0.3)), // 작고 짧은 음(오른손)
    ...Array.from({ length: 6 }, (_, i) => an(i * 1, 0.9, 48 + (i % 3), 0.8)), // 왼손
  ]
  const mk = () =>
    audioToInfo({
      fileName: 'e.wav',
      size: 1,
      durationSec: 8,
      notes: notes().slice(0, 12),
      allNotes: notes(),
      detectedCount: notes().length,
      bpm: { value: 120, confidence: 0.5 },
      key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })
  it('기본: 작고 짧은 음에 회색이 입혀지고, 크고 긴 음은 검은색(색 속성 없음)이다', () => {
    const xml = buildScore(mk(), applySettings(mk(), { audioEdit: false })).xml
    expect(colored(xml)).toBeGreaterThan(0)
    expect(colored(xml)).toBeLessThan((xml.match(/<note[ >]/g) ?? []).length * 0.6)
  })
  it('[주된 음 돋보이게]를 끄면 회색이 없다', () => {
    expect(colored(buildScore(mk(), applySettings(mk(), { audioEmphasis: false })).xml)).toBe(0)
  })
  it('멜로디만 방식에서는 회색이 없다', () => {
    expect(colored(buildScore(mk(), applySettings(mk(), { audioMode: 'melody' })).xml)).toBe(0)
  })
  it('정리를 끈 무손실 악보에서도 회색이 유지된다 (층 나누기를 거쳐도)', () => {
    expect(colored(buildScore(mk(), applySettings(mk(), { audioSimplify: false })).xml)).toBeGreaterThan(0)
  })
  it('음의 개수는 회색 표시와 상관없이 같다 (표시만 하고 지우지 않는다)', () => {
    const on = buildScore(mk(), applySettings(mk()))
    const off = buildScore(mk(), applySettings(mk(), { audioEmphasis: false }))
    expect((on.xml.match(/<pitch>/g) ?? []).length).toBe((off.xml.match(/<pitch>/g) ?? []).length)
  })
  it('색을 넣어도 MusicXML 구조가 맞다 (모든 note 요소가 닫혀 있고 undefined가 없다)', () => {
    const xml = buildScore(mk(), applySettings(mk())).xml
    expect(xml).not.toMatch(/undefined|NaN/)
    expect(parse(xml).nodeName).toBe('score-partwise')
  })
})

describe('주된 음은 성부 자리 안에서 길이를 지킨다 (selectMainNotes, fitMinorToVoices)', () => {
  const grid = buildMeasureGrid([{ ticks: 0, numerator: 4, denominator: 4 }], 480, 260)
  const dense = (seed: number, n = 180): QNote[] => {
    const r = rng(seed)
    return Array.from({ length: n }, () => {
      const start = Math.floor(r() * 140)
      return {
        start,
        end: start + 1 + Math.floor(r() * 28),
        midi: 50 + Math.floor(r() * 30),
        velocity: 0.3 + r() * 0.7,
      }
    })
  }
  const voicesOf = (notes: QNote[]) => {
    const lay = layoutTrack(notes, grid.measures)
    return { v: Math.max(1, ...lay.measures.map((m) => m.length)), warnings: lay.warnings }
  }
  it('성부 3개에 들어가는 만큼만 주된 음이 되고, 주된 음만 적으면 경고 없이 3성부 이하다', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const marked = selectMainNotes(dense(seed))
      const main = marked.filter((n) => !n.minor)
      const lay = voicesOf(main)
      expect(lay.warnings, `시드 ${seed}`).toEqual([])
      expect(lay.v).toBeLessThanOrEqual(MAIN_VOICES)
    }
  })
  it('음은 하나도 지워지지 않고 표시(minor)만 바뀐다', () => {
    const src = dense(3)
    const out = selectMainNotes(src)
    expect(out).toHaveLength(src.length)
    out.forEach((n, i) => {
      expect([n.start, n.end, n.midi]).toEqual([src[i].start, src[i].end, src[i].midi])
      if (src[i].minor) expect(n.minor).toBe(true)
    })
  })
  it('가장 중요한 음은 언제나 주된 음이고, 이미 덜 주된 음으로 표시된 음은 그대로 둔다', () => {
    const src: QNote[] = [q(0, 16, 60, 0.95), q(0, 16, 64, 0.2), q(4, 8, 70, 0.9)].map((n, i) => ({
      ...n,
      minor: i === 1,
    }))
    const out = selectMainNotes(src)
    expect(out[0].minor).toBeFalsy()
    expect(out[1].minor).toBe(true)
  })
  it('같은 시작·끝의 음은 한 화음으로 같은 자리를 쓰므로 함께 주된 음이 된다', () => {
    const chord = [q(0, 8, 60), q(0, 8, 64), q(0, 8, 67), q(0, 8, 72)]
    expect(selectMainNotes(chord).every((n) => !n.minor)).toBe(true)
  })
  it('자리가 충분하면 모두 주된 음이다 (성부 4개 겹침이어도 3성부까지만 주된 음)', () => {
    const four = [q(0, 16, 60), q(0, 15, 64), q(0, 14, 67), q(0, 13, 72)]
    const out = selectMainNotes(four)
    expect(out.filter((n) => !n.minor)).toHaveLength(MAIN_VOICES)
    expect(out.filter((n) => n.minor)).toHaveLength(1)
  })
  it('fitMinorToVoices: 자리가 모자라면 회색 음만 빠지고 주된 음은 모두 남는다', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const marked = selectMainNotes(dense(seed + 100))
      const input = [...marked.filter((n) => !n.minor), ...simplifyToChords(marked.filter((n) => n.minor))]
      const out = fitMinorToVoices(input)
      const mainIn = input.filter((n) => !n.minor),
        mainOut = out.filter((n) => !n.minor)
      expect(mainOut).toHaveLength(mainIn.length)
      expect(voicesOf(out).warnings, `시드 ${seed}`).toEqual([])
      expect(voicesOf(out).v).toBeLessThanOrEqual(4)
    }
  })
  it('fitMinorToVoices: 다 들어가면 그대로 돌려준다', () => {
    const notes = [q(0, 4, 60), { ...q(4, 8, 62), minor: true }]
    expect(fitMinorToVoices(notes)).toBe(notes)
  })
})

describe('악보 기본(대보표·정리·돋보이기): 주된 음 길이를 지키고 성부 초과 알림이 없다', () => {
  it('빽빽한 무작위 음 20가지 모두 4성부 이하, 성부 초과 알림 없음, 모든 음의 시작이 악보에 있다', () => {
    const r = rng(101)
    for (let trial = 0; trial < 20; trial++) {
      const notes = Array.from({ length: 220 }, () =>
        an(r() * 30, 0.1 + r() * 2.2, 36 + Math.floor(r() * 60), 0.3 + r() * 0.7),
      )
      const info = audioToInfo({
        fileName: 'k.wav',
        size: 1,
        durationSec: 30,
        notes: notes.slice(0, 20),
        allNotes: notes,
        detectedCount: notes.length,
        bpm: { value: 100, confidence: 0.5 },
        key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
        backend: 'cpu',
        elapsedMs: 1,
      })
      const res = buildScore(info, applySettings(info))
      expect(res.report.parts[0].maxVoices).toBeLessThanOrEqual(4)
      expect(res.report.warnings.some((w) => w.includes('성부가 4개를 넘어'))).toBe(false)
      expect(res.xml).not.toMatch(/undefined|NaN/)
      expect(res.model.parts).toHaveLength(1)
      expect(res.model.parts[0].staves.length).toBeGreaterThanOrEqual(1)
    }
  })
  it('보표별 소리 끄기: 오른손만 끄면 왼손만 재생되고, 악보는 그대로다', () => {
    const notes = [
      ...Array.from({ length: 10 }, (_, i) => an(i * 0.5, 0.45, 72 + (i % 4), 0.8)),
      ...Array.from({ length: 10 }, (_, i) => an(i * 0.5, 0.45, 48 + (i % 3), 0.8)),
    ]
    const info = audioToInfo({
      fileName: 'm.wav',
      size: 1,
      durationSec: 6,
      notes: notes.slice(0, 10),
      allNotes: notes,
      detectedCount: notes.length,
      bpm: { value: 120, confidence: 0.5 },
      key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })
    const base = buildScore(info, applySettings(info))
    const muted = buildScore(info, applySettings(info, { mutedTracks: [0] }))
    expect(muted.xml).toBe(base.xml)
    const midis = buildTimeline(muted.model).notes.map((n) => n.midi)
    expect(midis.length).toBeGreaterThan(0)
    expect(midis.every((m) => m < 60)).toBe(true)
    expect(buildTimeline(buildScore(info, applySettings(info, { mutedTracks: [0, 1] })).model).notes).toEqual([])
  })
})

describe('고치기 쉽게 (Finale 편집용, tidyForEditing)', () => {
  it('8분음표 이내로 끊긴 같은 음은 하나로 이어진다', () => {
    const out = tidyForEditing([q(0, 4, 60), q(6, 12, 60)])
    expect(out).toEqual([expect.objectContaining({ start: 0, end: 12, midi: 60 })])
  })
  it('멀리 떨어진 같은 음은 따로 남는다', () => {
    expect(tidyForEditing([q(0, 4, 60), q(8, 12, 60)])).toHaveLength(2)
  })
  it('16분음표 하나짜리 잔 조각은 빠진다 (전부 그런 경우는 남긴다)', () => {
    expect(tidyForEditing([q(0, 4, 60), q(0, 1, 64)]).map((n) => n.midi)).toEqual([60])
    expect(tidyForEditing([q(0, 1, 64)])).toHaveLength(1)
  })
  it('결과는 겹치지 않는 한 성부이고, 바로 이어진 같은 화음은 하나로 합친다', () => {
    const out = tidyForEditing([q(0, 4, 60), q(0, 4, 64), q(4, 8, 60), q(4, 8, 64), q(8, 12, 62)])
    expect(overlaps(out)).toBe(false)
    expect(out.filter((n) => n.midi === 60)).toEqual([expect.objectContaining({ start: 0, end: 8 })])
  })
  it('join=false면 끊긴 음을 이어 붙이지 않는다', () => {
    expect(tidyForEditing([q(0, 4, 60), q(5, 8, 60)], false)).toHaveLength(2)
  })
  it('악보: 편집용은 한 보표에 한 성부, 추가 보표 없이 같은 음은 이어서 적힌다', () => {
    const info = audioToInfo({
      fileName: 'e.wav',
      size: 1,
      durationSec: 6,
      notes: [],
      allNotes: [an(0, 2, 72), an(2.2, 2, 72), an(0, 4, 48), an(1, 0.5, 76), an(2, 0.5, 79)],
      detectedCount: 5,
      bpm: { value: 120, confidence: 0.5 },
      key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })
    const res = buildScore(info, applySettings(info))
    expect(res.report.parts).toHaveLength(1)
    expect(res.report.parts[0].maxVoices).toBe(1)
    expect(colored(res.xml)).toBe(0)
    // 8분음표 칸에 맞춰 적으므로 16분음표 길이(1칸)나 16분쉼표 조각이 없다
    const durations = [...res.xml.matchAll(/<duration>(\d+)<\/duration>/g)].map((m) => Number(m[1]))
    expect(durations.length).toBeGreaterThan(0)
    expect(durations.every((d) => d % 2 === 0)).toBe(true)
  })
})

describe('편집용: 오래 끄는 음 살리기와 뒷받침 음 빼기', () => {
  it('chordifyByOnset: 오래 끄는 음은 다음 음이 시작해도 화음에 남는다', () => {
    const out = chordifyByOnset([q(0, 8, 48), q(0, 2, 72), q(2, 4, 74), q(4, 6, 76)])
    expect(out.filter((n) => n.start === 2).map((n) => n.midi)).toEqual([48, 74])
    expect(out.filter((n) => n.start === 4).map((n) => n.midi)).toEqual([48, 76])
    expect(overlaps(out)).toBe(false)
  })
  it('chordifyByOnset: 한 화음은 4음까지, 가장 낮은 음·높은 음·센 음이 남는다', () => {
    const out = chordifyByOnset([
      q(0, 4, 40, 0.3),
      q(0, 4, 50, 0.9),
      q(0, 4, 55, 0.2),
      q(0, 4, 60, 0.8),
      q(0, 4, 70, 0.1),
    ])
    expect(out.map((n) => n.midi)).toEqual([40, 50, 60, 70])
  })
  it('dropBackgroundNotes: 소리가 작고 짧은 음을 정한 비율(기본 50%)만큼 뺀다 (5개 미만이면 그대로)', () => {
    const notes = Array.from({ length: 20 }, (_, i) => an(i, 0.5 + i * 0.1, 60 + (i % 12), 0.3 + i * 0.03))
    expect(dropBackgroundNotes(notes)).toHaveLength(10)
    expect(dropBackgroundNotes(notes, 0.35)).toHaveLength(13)
    expect(dropBackgroundNotes(notes.slice(0, 4))).toHaveLength(4)
  })
  it('decompose(relaxed): 8분음표 자리에서 시작하는 4분음표를 붙임줄 없이 한 음표로', () => {
    expect(decompose(2, 4, 4)).toEqual([2, 2])
    expect(decompose(2, 4, 4, true)).toEqual([4])
  })
})

describe('편집용: 박 단위 화음 (chordifyByBeat)', () => {
  it('박 사이에서 시작한 짧은 음(아르페지오)은 새 화음을 만들지 않고, 긴 화음이 쪼개지지 않는다', () => {
    const pad = [q(0, 16, 48), q(0, 16, 64), q(0, 16, 67)] // 한 마디 내내 울리는 화음
    const arpeggio = [q(2, 4, 72), q(6, 8, 76), q(10, 12, 79), q(14, 16, 76)] // 8분음표 아르페지오
    const out = chordifyByBeat([...pad, ...arpeggio])
    expect(new Set(out.map((n) => n.start)).size).toBeLessThanOrEqual(4) // 박마다 최대 4번 (8분음표 8번이 아님)
    expect(out.every((n) => n.start % 4 === 0)).toBe(true)
    expect(overlaps(out)).toBe(false)
  })
  it('박 사이에서 시작해도 한 박 이상 이어지는 음은 새 화음의 경계가 된다', () => {
    const out = chordifyByBeat([q(0, 2, 60), q(2, 8, 62)])
    expect(out.some((n) => n.start === 2 && n.midi === 62)).toBe(true)
  })
  it('같은 화음이 이어지면 하나로 합친다', () => {
    const out = chordifyByBeat([q(0, 16, 60), q(0, 16, 64)])
    expect(out).toEqual([
      expect.objectContaining({ start: 0, end: 16 }),
      expect.objectContaining({ start: 0, end: 16 }),
    ])
  })
  it('snapToBeatOrEighth: 박 1칸 이내는 박으로, 나머지는 8분음표 칸으로', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((v) => snapToBeatOrEighth(v))).toEqual([0, 0, 2, 4, 4, 4, 6, 8])
  })
})

describe('편집용: 계속 울리는 음은 다시 치지 않고 붙임줄로 이어서 적는다', () => {
  const grid = buildMeasureGrid([], 4, 16).measures
  const chords = [q(0, 8, 60), q(0, 4, 64), q(4, 8, 67)] // 도는 계속, 위의 음만 바뀐다
  it('layoutTrack(relaxed): 화음 중 이어지는 음(도)에만 붙임줄이 붙는다', () => {
    const [m1] = layoutTrack(chordifyByBeat(chords), grid, { relaxed: true }).measures[0]
    expect(m1.pieces.slice(0, 2)).toHaveLength(2)
    expect(m1.pieces[0].tieStartMidis).toEqual([60])
    expect(m1.pieces[1].tieStopMidis).toEqual([60])
    expect(m1.pieces[0].tieStart).toBe(false)
  })
  it('relaxed가 아니면 예전처럼 붙임줄을 만들지 않는다', () => {
    const [m1] = layoutTrack(chordifyByBeat(chords), grid).measures[0]
    expect(m1.pieces.some((p) => p.tieStartMidis || p.tieStopMidis)).toBe(false)
  })
  it('MusicXML에는 이어지는 음에만 tie가 적히고 재생에서는 한 음으로 합쳐진다', () => {
    const info = audioToInfo({
      fileName: 't.wav',
      size: 1,
      durationSec: 6,
      notes: [],
      allNotes: [an(0, 2, 60), an(0, 1, 64), an(1, 1, 67)],
      detectedCount: 3,
      bpm: { value: 120, confidence: 0.5 },
      key: { value: { fifths: 0, mode: 'major' }, confidence: 0.5 },
      backend: 'cpu',
      elapsedMs: 1,
    })
    const res = buildScore(info, applySettings(info))
    const doc = parse(res.xml)
    const notes = Array.from(doc.getElementsByTagName('note') as unknown as ArrayLike<Element>).filter(
      (n) => n.getElementsByTagName('pitch').length,
    )
    const tiedPitches = notes
      .filter((n) => n.getElementsByTagName('tie').length)
      .map((n) => n.getElementsByTagName('step')[0].textContent)
    expect(tiedPitches.length).toBeGreaterThan(0)
    expect(tiedPitches.every((s) => s === 'C')).toBe(true) // 위의 음(E, G)에는 붙임줄이 없다
    expect(buildTimeline(res.model).notes.filter((n) => n.midi === 60)).toHaveLength(1)
  })
})

describe('편집용: 계속 울리는 음이 끊기지 않게 (chordifyByBeat)', () => {
  it('한 화음에 5음이 있어 하나를 빼야 하면 앞 화음에서 이어져 온 음을 남긴다', () => {
    // 첫 박: 40·50·60·70 / 둘째 박: 40·50·60·70에 센 음 80이 더해지고 이어져 온 음은 약하다
    const out = chordifyByBeat([
      q(0, 8, 40, 0.5),
      q(0, 8, 50, 0.5),
      q(0, 8, 60, 0.2),
      q(0, 8, 70, 0.5),
      q(4, 8, 55, 0.9),
    ])
    // 이어져 온 60이 남아 첫 화음과 같아지므로 한 화음(0~8)으로 합쳐지고, 새로 들어온 55는 빠진다
    expect(out.map((n) => n.midi).sort((a, b) => a - b)).toEqual([40, 50, 60, 70])
    expect(out.every((n) => n.start === 0 && n.end === 8)).toBe(true)
  })
  it('앞뒤 화음에는 있는데 가운데 화음에서만 자리가 없어 빠진 음은 채워 넣는다', () => {
    const out = chordifyByBeat([
      q(0, 12, 60, 0.3),
      q(0, 12, 40),
      q(0, 12, 80),
      q(4, 8, 50),
      q(4, 8, 55),
      q(4, 8, 70, 0.9),
    ])
    // 가운데 박(4~8)에 60이 있어야 앞(0~4)·뒤(8~12)와 이어진다
    const middle = out.filter((n) => n.start <= 4 && n.end > 4).map((n) => n.midi)
    expect(middle).toContain(60)
  })
})

describe('편집용: 배음(한 옥타브 위 울림) 거르기 (dropOctaveHarmonics)', () => {
  const low = an(0, 2, 60, 0.8)
  it('한 옥타브 아래의 더 센 음과 같이 울리는 약한 음은 뺀다', () => {
    const out = dropOctaveHarmonics([low, an(0, 2, 72, 0.3)], 0.5)
    expect(out.map((n) => n.midi)).toEqual([60])
  })
  it('세기가 비슷하거나 센 옥타브 겹침(실제 악보의 겹침)은 남긴다', () => {
    expect(dropOctaveHarmonics([low, an(0, 2, 72, 0.6)], 0.5)).toHaveLength(2)
    expect(dropOctaveHarmonics([low, an(0, 2, 72, 0.9)], 0.5)).toHaveLength(2)
  })
  it('같이 울리지 않는 음(겹침이 70% 미만)은 남기고, ratio가 0이면 아무것도 빼지 않는다', () => {
    expect(dropOctaveHarmonics([low, an(1.5, 2, 72, 0.1)], 0.5)).toHaveLength(2)
    expect(dropOctaveHarmonics([low, an(0, 2, 72, 0.1)], 0)).toHaveLength(2)
  })
  it('두 옥타브 아래의 더 센 음도 기준이 된다', () => {
    expect(dropOctaveHarmonics([an(0, 2, 48, 0.9), an(0, 2, 72, 0.2)], 0.5)).toHaveLength(1)
  })
})

describe('편집용: 짧은 화음 변화 합치기 (smoothSteps)', () => {
  // 한 마디 내내 도·미·솔이 울리고, 둘째 박에서만 위의 음 하나가 잠깐 바뀐다 (스쳐 지나가는 음)
  const notes = [q(0, 16, 48), q(0, 16, 64), q(0, 4, 67), q(4, 8, 69), q(8, 16, 67)]
  it('끄면(0) 박마다 화음이 바뀐다', () => {
    const out = chordifyByBeat(notes, 4, 5, true, { steps: 0, similarity: 0.6 })
    expect(new Set(out.map((n) => n.start)).size).toBe(3)
  })
  it('켜면 앞 화음과 비슷하고 가장 낮은 음이 같은 짧은 변화는 앞 화음에 합쳐진다', () => {
    const out = chordifyByBeat(notes, 4, 5, true, { steps: 4, similarity: 0.5 })
    expect(new Set(out.map((n) => n.start)).size).toBeLessThan(3)
    expect(overlaps(out)).toBe(false)
  })
  it('가장 낮은 음이 바뀌는 변화는 합치지 않는다 (화음의 뿌리가 바뀐 것)', () => {
    const out = chordifyByBeat(
      [q(0, 8, 48), q(0, 8, 64), q(4, 8, 40), q(4, 8, 64)]
        .filter((n) => n.midi !== 48 || n.start === 0)
        .map((n) => (n.midi === 48 && n.end === 8 ? { ...n, end: 4 } : n)),
      4,
      5,
      true,
      { steps: 4, similarity: 0.1 },
    )
    expect(out.some((n) => n.start === 4 && n.midi === 40)).toBe(true)
  })
})

describe('편집용 정리에서 [같은 음 이어 붙이기]를 끈 경우', () => {
  const grid = [{ startStep: 0, length: 16, numerator: 4, denominator: 4 }]
  const q = (start: number, end: number, midi = 60) => ({ start, end, midi, velocity: 0.7 })
  const ties = (notes: ReturnType<typeof q>[], join: boolean) =>
    layoutTrack(tidyForEditing(notes, join), grid, { relaxed: true })
      .measures[0].flatMap((v) => v.pieces)
      .filter((p) => p.tieStart || p.tieStartMidis?.length).length

  it('따로 친 같은 음은 붙임줄로 잇지 않는다', () => {
    const struck = [q(0, 4), q(4, 8), q(8, 12)]
    expect(ties(struck, false)).toBe(0)
  })

  it('한 번 쳐서 길게 울리는 음은 박마다 나눠 적되 붙임줄로 이어 다시 치지 않는다', () => {
    // 낮은 음이 두 박 울리는 동안 위의 음이 바뀐다
    const held = [q(0, 8, 48), q(0, 4, 64), q(4, 8, 67)]
    expect(ties(held, false)).toBe(1)
  })
})
