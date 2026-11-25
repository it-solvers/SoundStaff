import { drumRecipe } from '../src/play/drums'
import { drumSound } from '../src/midi/percussion'
import { buildTimeline } from '../src/play/timeline'
import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { buildInstrumentScore, defaultSettings } from '../src/score/buildScore'
import type { ScoreModel } from '../src/score/types'
import { escapeXml, toMusicXml } from '../src/score/toMusicXml'
import { G, info, track } from './helpers'

type El = Element

const parse = (xml: string): El =>
  new DOMParser().parseFromString(xml, 'application/xml').documentElement as unknown as El
const kids = (el: El, tag: string): El[] =>
  (Array.from(el.childNodes) as unknown as El[]).filter((n) => n.nodeName === tag)
const all = (el: El, tag: string): El[] => Array.from(el.getElementsByTagName(tag) as unknown as ArrayLike<El>)
const text = (el: El, tag: string) => kids(el, tag)[0]?.textContent ?? ''

/** XML을 다시 읽어 성부별 길이 합을 계산한다 (악보 모델이 아니라 만들어진 파일 기준) */
function voiceSums(measure: El): Map<string, number> {
  const sums = new Map<string, number>()
  for (const n of kids(measure, 'note')) {
    if (kids(n, 'chord').length) continue
    const v = text(n, 'voice')
    sums.set(v, (sums.get(v) ?? 0) + Number(text(n, 'duration')))
  }
  return sums
}

const melody = track(0, 'Melody', [
  [0, 4, 72],
  [4, 4, 74],
  [8, 12, 76], // 마디선을 넘는 음 (4/4: 8~20 → 붙임줄)
  [24, 8, 72],
])
const bass = track(1, 'Bass', [
  [0, 16, 48],
  [16, 16, 43],
  [32, 16, 41],
])
const drums = track(2, 'Drums', [[0, 2, 36]], { kind: 'drum', channel: 10 })

describe('MusicXML 구조 — 악기별 악보', () => {
  const i = info([melody, bass, drums], {
    fileName: 'test.mid',
    keySignatures: [{ ticks: 0, fifths: -3, tonic: 'Eb', scale: 'major' }],
    tempos: [
      { ticks: 0, bpm: 100 },
      { ticks: 32 * G, bpm: 120 },
    ],
  })
  const res = buildInstrumentScore(i, defaultSettings(i))
  const root = parse(res.xml)

  it('score-partwise 3.1 이고 제목·파트 수가 맞다 (타악기 포함)', () => {
    expect(root.nodeName).toBe('score-partwise')
    expect(root.getAttribute('version')).toBe('3.1')
    expect(all(root, 'work-title')[0].textContent).toBe('test')
    expect(all(root, 'score-part').length).toBe(3)
    expect(all(root, 'part').length).toBe(3)
  })

  it('모든 마디·성부의 길이 합이 박자표와 정확히 일치한다', () => {
    for (const part of all(root, 'part')) {
      for (const m of kids(part, 'measure')) {
        for (const [voice, sum] of voiceSums(m))
          expect(sum, `${part.getAttribute('id')} ${m.getAttribute('number')}마디 ${voice}성부`).toBe(16)
      }
    }
  })

  it('조표·박자표·음자리표를 기록한다', () => {
    const attrs = all(root, 'attributes')[0]
    expect(all(attrs, 'fifths')[0].textContent).toBe('-3')
    expect(all(attrs, 'mode')[0].textContent).toBe('major')
    expect(all(attrs, 'beats')[0].textContent).toBe('4')
    expect(all(attrs, 'beat-type')[0].textContent).toBe('4')
    const clefs = all(root, 'sign').map((s) => s.textContent)
    expect(clefs).toEqual(['G', 'F', 'percussion']) // 선율 = 높은음자리표, 베이스 = 낮은음자리표, 드럼 = 타악기
  })

  it('템포를 기록하고, 템포 변화는 해당 마디에 둔다', () => {
    const sounds = all(root, 'sound').map((s) => s.getAttribute('tempo'))
    expect(sounds).toEqual(['100', '120'])
    const part = all(root, 'part')[0]
    const m3 = kids(part, 'measure')[2]
    expect(all(m3, 'sound')[0].getAttribute('tempo')).toBe('120')
  })

  it('마디선을 넘는 음은 같은 높이의 붙임줄로 이어진다', () => {
    const part = all(root, 'part')[0]
    const [m1, m2] = kids(part, 'measure')
    const tiesOf = (m: El) =>
      kids(m, 'note')
        .filter((n) => kids(n, 'pitch').length && kids(n, 'tie').length)
        .map(
          (n) =>
            `${text(kids(n, 'pitch')[0], 'step')}${text(kids(n, 'pitch')[0], 'octave')}:${kids(n, 'tie')
              .map((t) => t.getAttribute('type'))
              .join('+')}`,
        )
    expect(tiesOf(m1)).toEqual(['E5:start'])
    expect(tiesOf(m2)).toEqual(['E5:stop'])
  })

  it('이상한 값(undefined, NaN, null)이 글자로 섞여 들어가지 않는다', () => {
    for (const bad of ['undefined', 'NaN', 'null', '[object']) expect(res.xml).not.toContain(bad)
  })

  it('제목에 XML 특수문자가 있어도 올바른 파일이 되고 다시 읽으면 같다', () => {
    const tricky = 'A & B <C> "D" \'E\''
    const src = info([melody], { fileName: `${tricky}.mid` })
    const r = buildInstrumentScore(src, defaultSettings(src))
    const doc = parse(r.xml)
    expect(all(doc, 'work-title')[0].textContent).toBe(tricky)
    expect(all(doc, 'credit-words')[0].textContent).toBe(tricky)
    expect(escapeXml('<&>')).toBe('&lt;&amp;&gt;')
  })

  it('제목을 맑은 고딕으로 지정한 credit을 넣는다 (Finale에서 한글이 깨지지 않게)', () => {
    const cw = all(root, 'credit-words')[0]
    expect(cw.getAttribute('font-family')).toBe('Malgun Gothic')
    expect(kids(all(root, 'credit')[0], 'credit-type')[0].textContent).toBe('title')
  })
})

describe('MusicXML 구조 — 한 파트에 보표 2개 (대보표) 지원', () => {
  // 앱은 악기(트랙)마다 한 보표를 만들지만, MusicXML 생성기는 한 파트에 보표 여러 개도 올바르게 쓸 수 있어야 한다.
  const i = info([melody, bass, drums])
  const base = buildInstrumentScore(i, defaultSettings(i)).model
  const src = base.parts[0]
  const grand: ScoreModel = {
    ...base,
    parts: [
      {
        ...src,
        name: 'Piano',
        instrumentName: 'Acoustic Grand Piano',
        program: 0,
        staves: [
          { clef: 'G', layout: src.staves[0].layout },
          { clef: 'F', layout: src.staves[0].layout },
        ],
      },
    ],
  }
  const root = parse(toMusicXml(grand))

  it('한 파트에 보표 2개 (높은음자리표 + 낮은음자리표)', () => {
    expect(all(root, 'score-part').length).toBe(1)
    expect(all(root, 'staves')[0].textContent).toBe('2')
    const clefs = all(root, 'clef').map((c) => `${c.getAttribute('number')}:${text(c, 'sign')}`)
    expect(clefs).toEqual(['1:G', '2:F'])
    expect(all(root, 'part-symbol')[0].textContent).toBe('brace')
  })

  it('모든 음·쉼표에 보표 번호가 있고 성부 번호가 보표마다 겹치지 않는다', () => {
    const voicesByStaff = new Map<string, Set<string>>()
    for (const n of all(root, 'note')) {
      const staff = text(n, 'staff')
      expect(['1', '2']).toContain(staff)
      if (!voicesByStaff.has(staff)) voicesByStaff.set(staff, new Set())
      voicesByStaff.get(staff)!.add(text(n, 'voice'))
    }
    const [a, b] = [voicesByStaff.get('1')!, voicesByStaff.get('2')!]
    expect([...a].filter((v) => b.has(v))).toEqual([])
  })

  it('모든 성부의 길이 합이 마디 길이와 같고, backup 길이도 마디 길이와 같다', () => {
    for (const m of kids(all(root, 'part')[0], 'measure')) {
      for (const [voice, sum] of voiceSums(m)) expect(sum, `${m.getAttribute('number')}마디 ${voice}성부`).toBe(16)
      for (const b of kids(m, 'backup')) expect(text(b, 'duration')).toBe('16')
    }
  })
})

describe('타악기 보표', () => {
  // 한 박 안: 하이햇 8분 두 번(손), 첫 박에 큰북(발), 둘째 박에 작은북, 자리를 모르는 번호 하나
  const kit = track(
    0,
    'Kit',
    [
      [0, 1, 42],
      [0, 1, 36],
      [2, 1, 42],
      [4, 8, 38],
      [8, 1, 36],
      [8, 1, 100],
    ],
    { kind: 'drum', channel: 10 },
  )
  const i = info([kit])
  const res = buildInstrumentScore(i, defaultSettings(i))
  const root = parse(res.xml)
  const notes = all(root, 'note').filter((n) => kids(n, 'unpitched').length)

  it('드럼만 있는 파일도 타악기 음자리표 악보가 되고 조표·음높이는 적지 않는다', () => {
    expect(all(root, 'sign').map((s) => s.textContent)).toEqual(['percussion'])
    expect(all(root, 'key')).toHaveLength(0)
    expect(all(root, 'pitch')).toHaveLength(0)
    expect(notes).toHaveLength(5)
  })

  it('손은 1성부(위 줄기), 발은 2성부(아래 줄기)이고 심벌은 × 머리다', () => {
    const summary = notes.map(
      (n) =>
        `${text(kids(n, 'unpitched')[0], 'display-step')}${text(kids(n, 'unpitched')[0], 'display-octave')} v${text(n, 'voice')} ${text(n, 'stem')} ${text(n, 'notehead')}`,
    )
    expect(summary).toEqual(['G5 v1 up x', 'G5 v1 up x', 'C5 v1 up ', 'F4 v2 down ', 'F4 v2 down '])
  })

  it('길이는 다음 타격이나 박 끝까지이고 붙임줄이 없으며 마디 길이가 맞다', () => {
    expect(notes.map((n) => text(n, 'duration'))).toEqual(['2', '2', '4', '4', '4'])
    expect(all(root, 'tie')).toHaveLength(0)
    for (const [, sum] of voiceSums(all(root, 'measure')[0])) expect(sum).toBe(16)
  })

  it('쓰인 타악기마다 악기와 midi-unpitched(번호 + 1)를 적고 음이 가리킨다', () => {
    expect(all(root, 'midi-unpitched').map((e) => e.textContent)).toEqual(['37', '39', '43'])
    expect(all(root, 'midi-channel').every((e) => e.textContent === '10')).toBe(true)
    const ids = all(root, 'score-instrument').map((e) => e.getAttribute('id'))
    for (const n of notes) expect(ids).toContain(kids(n, 'instrument')[0].getAttribute('id'))
  })

  it('자리를 모르는 번호는 빼고 알린다', () => {
    expect(res.report.warnings.some((w) => w.includes('1개는 악보에 넣지 않았습니다'))).toBe(true)
  })

  it('박 중간에서 시작해 나뉘는 길이는 붙임줄 대신 쉼표로 채운다', () => {
    const k = info([track(0, 'Kit', [[1, 1, 38]], { kind: 'drum', channel: 10 })])
    const doc = parse(buildInstrumentScore(k, defaultSettings(k)).xml)
    expect(all(doc, 'tie')).toHaveLength(0)
    expect(all(doc, 'unpitched')).toHaveLength(1)
  })

  it('타악기 보표는 5줄이고, 발만 치는 마디의 빈 온쉼표는 감춘다', () => {
    expect(all(root, 'staff-lines').map((e) => e.textContent)).toEqual(['5'])
    const k = info([track(0, 'Kick', [[0, 1, 36]], { kind: 'drum', channel: 10 })])
    const doc = parse(buildInstrumentScore(k, defaultSettings(k)).xml)
    const first = all(doc, 'note')[0]
    expect(kids(first, 'rest')).toHaveLength(1)
    expect(first.getAttribute('print-object')).toBe('no')
  })

  it('재생 시간표에 타악기 표시와 함께 들어가고, 소리를 끄면 빠진다', () => {
    const notes = buildTimeline(res.model).notes
    expect(notes.map((n) => n.midi)).toEqual([36, 42, 42, 38, 36])
    expect(notes.every((n) => n.drum)).toBe(true)
    const muted = buildInstrumentScore(i, { ...defaultSettings(i), mutedTracks: [0] })
    expect(buildTimeline(muted.model).notes).toEqual([])
  })

  it('악보에 적을 수 있는 모든 타악기에 소리가 있다', () => {
    for (let midi = 35; midi <= 81; midi++) {
      expect(drumSound(midi), `${midi}`).toBeDefined()
      expect(drumRecipe(midi).length, `${midi}`).toBeGreaterThan(0)
      for (const l of drumRecipe(midi)) expect(l.decay + (l.delay ?? 0)).toBeLessThan(2)
    }
  })
})

describe('타악기 트랙 모으기', () => {
  const drum = (index: number, name: string, notes: [number, number, number][]) =>
    track(index, name, notes, { kind: 'drum', channel: 10 })
  const i = info([
    drum(0, 'B.D', [
      [0, 1, 36],
      [8, 1, 36],
    ]),
    drum(1, 'S.D', [[4, 1, 38]]),
    drum(2, 'Cym', [[0, 1, 49]]),
    drum(3, 'Tambourine', [[4, 1, 54]]),
  ])
  const build = (o = {}) => buildInstrumentScore(i, { ...defaultSettings(i), ...o })

  it('드럼 세트는 한 보표, 손 타악기는 따로이며 타격은 빠지지 않는다', () => {
    const r = build()
    expect(r.model.parts.map((p) => p.name)).toEqual(['Drum Set', 'Tambourine'])
    expect(buildTimeline(r.model).notes.map((n) => n.midi)).toEqual([36, 49, 38, 54, 36])
    expect(r.report.warnings.some((w) => w.includes('4개를 보표 2개'))).toBe(true)
  })

  it('원본 트랙의 소리를 끄면 그 타격만 재생하지 않고 악보에는 남는다', () => {
    const r = build({ mutedTracks: [0] })
    expect(buildTimeline(r.model).notes.map((n) => n.midi)).toEqual([49, 38, 54])
    expect(all(parse(r.xml), 'unpitched')).toHaveLength(5)
  })

  it('트랙을 빼면 보표에서도 빠지고, 정리를 끄면 트랙마다 따로다', () => {
    expect(buildTimeline(build({ excludedTracks: [2] }).model).notes.map((n) => n.midi)).toEqual([36, 38, 54, 36])
    expect(build({ midiTidy: false }).model.parts).toHaveLength(4)
  })
})

describe('읽기 좋은 MIDI 악보', () => {
  const build = (program: number, notes: [number, number, number][], o: { midiTidy?: boolean } = {}) => {
    const i = info([track(0, 'A', notes, { program })])
    const r = buildInstrumentScore(i, { ...defaultSettings(i), ...o })
    return { ...r, root: parse(r.xml) }
  }
  const clefs = (root: El) => all(root, 'clef').map((c) => `${text(c, 'sign')}${text(c, 'clef-octave-change')}`)

  it('기타·베이스는 아래 8 음자리표이고 음높이는 그대로, 그림이 안 나오는 위 8은 쓰지 않는다', () => {
    const guitar = build(24, [[0, 4, 40]])
    expect(clefs(guitar.root)).toEqual(['G-1'])
    expect(text(all(guitar.root, 'pitch')[0], 'octave')).toBe('2')
    expect(clefs(build(33, [[0, 4, 28]]).root)).toEqual(['F-1'])
    expect(clefs(build(98, [[0, 4, 96]]).root)).toEqual(['G'])
    expect(clefs(build(73, [[0, 4, 72]]).root)).toEqual(['G'])
  })

  it('아주 높은 악기는 15ma 점선으로 낮춰 적고, 음이 있는 구간마다 시작·끝이 있으며 음높이는 그대로다', () => {
    const r = build(98, [
      [0, 4, 97],
      [16, 4, 93],
      [48, 4, 95],
    ])
    expect(all(r.root, 'octave-shift').map((e) => `${e.getAttribute('type')}${e.getAttribute('size')}`)).toEqual([
      'down15',
      'stop15',
      'down15',
      'stop15',
    ])
    expect(text(all(r.root, 'pitch')[0], 'octave')).toBe('7')
    expect(all(build(73, [[0, 4, 76]]).root, 'octave-shift')).toHaveLength(0)
  })

  it('음역이 넓은 건반악기는 두 보표로 나누고, 좁으면 한 보표다', () => {
    const wide: [number, number, number][] = [
      [0, 4, 43],
      [0, 4, 72],
    ]
    expect(clefs(build(4, wide).root)).toEqual(['G', 'F'])
    expect(clefs(build(4, [[0, 4, 72]]).root)).toEqual(['G'])
    expect(build(73, wide).model.parts[0].staves).toHaveLength(1)
    expect(build(50, wide).model.parts[0].staves).toHaveLength(2) // 합주 현악은 화음의 덧줄이 많으면 나눈다
  })

  // 계속 울리는 낮은 음 위에 음이 이어지는 모양
  const ringing: [number, number, number][] = [
    [0, 16, 48],
    [4, 4, 60],
    [8, 8, 64],
  ]

  it('정리를 켜면(기본) 한 성부이고 음은 빠지지 않으며 붙임줄이 늘지 않는다', () => {
    const r = build(73, ringing)
    expect(r.report.parts[0].maxVoices).toBe(1)
    expect(buildTimeline(r.model).notes.map((n) => n.midi)).toEqual([48, 60, 64])
    expect(all(r.root, 'tie')).toHaveLength(0)
  })

  it('정리를 끄면 원래 길이대로 여러 성부로 적는다', () => {
    const r = build(73, ringing, { midiTidy: false })
    expect(r.report.parts[0].maxVoices).toBe(2)
    expect(buildTimeline(r.model).notes[0].duration).toBeGreaterThan(2)
  })
})

describe('만들 수 없는 파일의 오류 안내', () => {
  it('타악기를 모두 빼면 남은 악기가 없다고 알린다', () => {
    const i = info([drums])
    expect(() => buildInstrumentScore(i, { ...defaultSettings(i), excludedTracks: [drums.index] })).toThrow(
      '악보에 넣을 악기가 없습니다',
    )
  })
})
