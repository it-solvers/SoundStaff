import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { audioTracks, audioToInfo, HAND_SPLIT } from '../src/audio/toInfo'
import { simplifyToChords, type QNote } from '../src/midi/quantize'
import type { AudioNote } from '../src/midi/types'
import { buildScore } from '../src/score/buildScore'
import { materializeAudio } from '../src/score/audioInfo'
import { applySettings } from '../src/score/settings'
import { buildTimeline } from '../src/play/timeline'
import { rng, transcriptionCoverage } from './helpers'

const q = (start: number, end: number, midi: number, velocity = 0.7): QNote => ({ start, end, midi, velocity })
const an = (startSec: number, durationSec: number, midi: number, velocity = 0.7): AudioNote => ({
  startSec,
  durationSec,
  midi,
  velocity,
})
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

  it('악보는 오른손·왼손 두 단이고 음자리표는 G·F, 파트 이름은 정해진 이름이다', () => {
    const res = buildScore(info(), applySettings(info()))
    const doc = parse(res.xml)
    expect(count(doc, 'score-part')).toBe(2)
    expect(
      Array.from(doc.getElementsByTagName('part-name') as unknown as ArrayLike<Element>).map((e) => e.textContent),
    ).toEqual(['오른손 (높은 음)', '왼손 (낮은 음)'])
    expect(
      Array.from(doc.getElementsByTagName('sign') as unknown as ArrayLike<Element>).map((e) => e.textContent),
    ).toEqual(['G', 'F'])
  })

  it('왼손 화음은 화음(chord)으로 적히고, 한 단은 한 성부라 backup이 없다', () => {
    const res = buildScore(info(), applySettings(info()))
    expect(count(parse(res.xml), 'chord')).toBeGreaterThan(0)
    expect(res.xml).not.toContain('<backup>')
  })

  it('찾은 음이 모두 악보에 있다 (화음 정리로 빠지는 음은 없다: 이 곡은 4음 이하)', () => {
    const res = buildScore(info(), applySettings(info()))
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

  it('읽기 쉽게 정리를 켜면 아주 빽빽한 무작위 음에서도 오류 없이 만들어지고 한 단에 backup이 없다', () => {
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
    const res = buildScore(i, applySettings(i, { audioSimplify: true }))
    expect(res.xml).not.toContain('<backup>')
    expect(res.xml).not.toMatch(/undefined|NaN/)
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
    const res = buildScore(mk(cluster), applySettings(mk(cluster), { audioSimplify: true }))
    expect(res.report.warnings.some((w) => w.includes('2개') && w.includes('전체 8개'))).toBe(true)
  })
  it('빠진 음이 없으면 알림도 없다', () => {
    const calm = [an(0, 1, 72), an(1, 1, 74), an(2, 1, 76), an(3, 1, 77)]
    const res = buildScore(mk(calm), applySettings(mk(calm), { audioSimplify: true }))
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
      const res = buildScore(i, applySettings(i))
      const m = /음 (\d+)개\(전체 (\d+)개 중\)/.exec(res.report.warnings.join(' '))
      const removed = m ? Number(m[1]) : 0
      const inScore = (res.xml.match(/<pitch>/g) ?? []).length - (res.xml.match(/<tie type="stop"\/>/g) ?? []).length
      expect(notes.length - removed, `시도 ${trial}`).toBe(inScore)
    }
  })
})

describe('찾은 음은 100% 악보에 옮겨진다 (기본: 무손실)', () => {
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
    const res = buildScore(info, applySettings(info, over))
    return { res, ...transcriptionCoverage(all, buildTimeline(res.model).notes, bpm) }
  }

  it('설정을 따로 주지 않으면 정리하지 않는다', () =>
    expect(applySettings(mkInfo([an(0, 1, 60)], 100)).audioSimplify).toBe(false))

  it('무작위로 아주 빽빽하게 겹친 음 12가지에서 찾은 음이 하나도 빠지지 않는다 (같은 높이·시작 오차 1칸 이내)', () => {
    const r = rng(23)
    for (let trial = 0; trial < 12; trial++) {
      const notes = Array.from({ length: 400 }, () =>
        an(r() * 25, 0.04 + r() * 3, 30 + Math.floor(r() * 70), 0.3 + r() * 0.7),
      )
      const c = coverage(notes, 80 + trial * 9)
      expect(c.matched, `시도 ${trial}: 빠진 음 ${JSON.stringify(c.missing.slice(0, 3))}`).toBe(c.total)
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
