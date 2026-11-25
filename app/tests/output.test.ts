import { ellipsize, measureCount, staffCount, workTitle } from '../src/score/pageLayout'
import { fitZoom, PAGE_FILL_LIMIT } from '../src/score/fitPage'
import { Midi } from '@tonejs/midi'
import { DOMParser } from '@xmldom/xmldom'
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { readMidiFile } from '../src/midi/readMidi'
import { buildInstrumentScore } from '../src/score/buildScore'
import { buildPianoMidi } from '../src/score/exportPianoMidi'
import { buildZip } from '../src/score/exportZip'
import { mergeFiles } from '../src/score/mergeFiles'
import {
  KEY_OPTIONS,
  applySettings,
  fileValues,
  isValidBeats,
  isValidTempo,
  tempoAlternatives,
} from '../src/score/settings'
import { G, info, track } from './helpers'

const melody = track(0, 'Melody', [
  [0, 4, 72],
  [4, 4, 74],
  [8, 8, 76],
])
const bass = track(1, '베이스', [[0, 16, 48]]) // 한글 트랙 이름
const drums = track(2, 'Drums', [[0, 2, 36]], { kind: 'drum', channel: 10 })

describe('악보 설정 (applySettings)', () => {
  const i = info([melody], {
    fileName: '곡 이름.mid',
    tempos: [
      { ticks: 0, bpm: 90 },
      { ticks: 32 * G, bpm: 110 },
    ],
    timeSignatures: [{ ticks: 0, numerator: 3, denominator: 4 }],
    keySignatures: [{ ticks: 0, fifths: -3, tonic: 'C', scale: 'minor' }],
  })

  it('바꾼 값이 없으면 MIDI 값(템포 변화 포함)과 파일 이름 제목을 그대로 쓴다', () => {
    const s = applySettings(i)
    expect(s.tempos).toEqual(i.tempos)
    expect(s.timeSignatures).toEqual(i.timeSignatures)
    expect(s.key).toEqual({ fifths: -3, mode: 'minor' })
    expect(s.title).toBe('곡 이름')
    expect(s.composer).toBe('')
  })

  it('템포·박자를 직접 입력하면 파일의 변화 정보는 그 값 하나로 바뀐다', () => {
    const s = applySettings(i, { tempo: 150, beats: 6, beatType: 8 })
    expect(s.tempos).toEqual([{ ticks: 0, bpm: 150 }])
    expect(s.timeSignatures).toEqual([{ ticks: 0, numerator: 6, denominator: 8 }])
  })

  it('박자의 윗수만 바꿔도 아랫수는 파일 값을 쓴다', () => {
    expect(applySettings(i, { beats: 5 }).timeSignatures[0]).toMatchObject({ numerator: 5, denominator: 4 })
  })

  it('제목·작곡자는 앞뒤 공백을 지우고, 제목이 비면 파일 이름으로 되돌린다', () => {
    const s = applySettings(i, { title: '  새 제목  ', composer: '  홍길동 ' })
    expect(s.title).toBe('새 제목')
    expect(s.composer).toBe('홍길동')
    expect(applySettings(i, { title: '   ' }).title).toBe('곡 이름')
  })

  it('파일에 정보가 없으면 MIDI 표준 기본값(120BPM, 4/4)과 C장조를 쓴다', () => {
    const bare = info([melody], { tempos: [], timeSignatures: [], keySignatures: [] })
    expect(fileValues(bare)).toMatchObject({
      tempo: 120,
      beats: 4,
      beatType: 4,
      key: { fifths: 0, mode: 'major' },
      keyFromFile: false,
    })
    expect(applySettings(bare).tempos).toEqual([{ ticks: 0, bpm: 120 }])
  })

  it('입력값 검사: 템포 20~400, 박자 윗수 1~32 정수', () => {
    expect([19, 20, 400, 401, NaN].map(isValidTempo)).toEqual([false, true, true, false, false])
    expect([0, 1, 32, 33, 2.5].map(isValidBeats)).toEqual([false, true, true, false, false])
  })

  it('조성 목록은 장조 15개 + 단조 15개이고 값이 겹치지 않는다', () => {
    expect(KEY_OPTIONS).toHaveLength(30)
    expect(new Set(KEY_OPTIONS.map((o) => o.value)).size).toBe(30)
    expect(KEY_OPTIONS.find((o) => o.value === 'M:-3')!.label).toBe('E♭ 장조 (♭3개)')
    expect(KEY_OPTIONS.find((o) => o.value === 'm:-3')!.label).toBe('C 단조 (♭3개)')
    expect(KEY_OPTIONS.find((o) => o.value === 'M:0')!.label).toBe('C 장조 (♯♭ 없음)')
  })

  it('바꾼 설정이 만들어진 악보에 반영된다 (조성·박자·템포·제목·작곡자)', () => {
    const s = applySettings(info([melody, bass]), {
      title: 'A & B',
      composer: '작곡가',
      tempo: 77,
      beats: 3,
      key: { fifths: 2, mode: 'major' },
    })
    const res = buildInstrumentScore(info([melody, bass]), s)
    const doc = new DOMParser().parseFromString(res.xml, 'application/xml').documentElement as unknown as Element
    const text = (tag: string) => (doc.getElementsByTagName(tag)[0] as Element).textContent
    expect(text('work-title')).toBe('A & B')
    expect(text('fifths')).toBe('2')
    expect(text('beats')).toBe('3')
    expect(res.xml).toContain('tempo="77"')
    expect(text('creator')).toBe('작곡가')
    const credits = Array.from(doc.getElementsByTagName('credit-type') as unknown as ArrayLike<Element>).map(
      (c) => c.textContent,
    )
    expect(credits).toEqual(['title', 'composer'])
  })

  it('작곡자가 비어 있으면 creator·composer credit을 만들지 않는다', () => {
    const res = buildInstrumentScore(info([melody]), applySettings(info([melody])))
    expect(res.xml).not.toContain('<creator')
    expect(res.xml).not.toContain('<credit-type>composer')
  })
})

describe('여러 파일 합치기 (mergeFiles)', () => {
  const a = info([melody], {
    fileName: 'a.mid',
    tempos: [{ ticks: 0, bpm: 100 }],
    keySignatures: [{ ticks: 0, fifths: 0, tonic: 'C', scale: 'major' }],
  })
  const b = {
    ...info([bass], {
      fileName: 'b.mid',
      tempos: [{ ticks: 0, bpm: 140 }],
      timeSignatures: [{ ticks: 0, numerator: 3, denominator: 4 }],
      keySignatures: [{ ticks: 0, fifths: 2, tonic: 'D', scale: 'major' }],
    }),
    ppq: 960,
  }

  it('파일이 하나면 그대로 돌려준다', () => {
    const r = mergeFiles([a])
    expect(r.info).toBe(a)
    expect(r.warnings).toEqual([])
  })

  it('모든 파일의 트랙을 모으고 트랙 이름에 파일 이름을 붙인다', () => {
    const r = mergeFiles([a, b])
    expect(r.info.tracks.map((t) => t.name)).toEqual(['a: Melody', 'b: 베이스'])
    expect(r.info.tracks.map((t) => t.index)).toEqual([0, 1])
    expect(r.info.fileName).toBe('a 외 1개.mid')
  })

  it('첫 번째 파일 기준으로 맞추고 템포·박자·조성이 다르면 각각 경고한다', () => {
    const r = mergeFiles([a, b])
    expect(r.info.tempos).toEqual(a.tempos)
    expect(r.info.ppq).toBe(a.ppq)
    expect(r.warnings).toHaveLength(3)
    expect(r.warnings.join(' ')).toContain('템포')
    expect(r.warnings.join(' ')).toContain('박자')
    expect(r.warnings.join(' ')).toContain('조성')
  })

  it('PPQ가 다른 파일은 첫 번째 파일의 PPQ로 환산해 같은 박 위치에 놓는다', () => {
    const r = mergeFiles([a, b])
    // b는 PPQ 960: 틱 값이 절반이 되어야 480 기준과 같은 박이다
    expect(r.info.tracks[1].notes[0].durationTicks).toBe(Math.round(bass.notes[0].durationTicks * 0.5))
    expect(bass.notes[0].durationTicks).toBe(r.info.tracks[1].notes[0].durationTicks * 2)
  })

  it('합친 파일로 악보를 만들면 모든 파일의 음표가 들어간다', () => {
    const r = mergeFiles([a, b])
    const res = buildInstrumentScore(r.info, applySettings(r.info))
    expect(res.report.parts.reduce((a, p) => a + p.noteCount, 0)).toBe(melody.noteCount + bass.noteCount)
  })
})

describe('피아노 MIDI (buildPianoMidi)', () => {
  const src = info([melody, bass, drums], {
    tempos: [{ ticks: 0, bpm: 90 }],
    timeSignatures: [{ ticks: 0, numerator: 3, denominator: 4 }],
    keySignatures: [{ ticks: 0, fifths: -3, tonic: 'C', scale: 'minor' }],
  })
  const settings = applySettings(src)
  const bytes = buildPianoMidi(src, settings)
  const midi = new Midi(bytes)

  it('드럼은 빼고 음높이 트랙만 담으며 음표가 하나도 빠지지 않는다', () => {
    expect(midi.tracks).toHaveLength(2)
    expect(midi.tracks.map((t) => t.notes.length)).toEqual([3, 1])
    expect(midi.tracks[0].notes.map((n) => n.midi)).toEqual([72, 74, 76])
  })

  it('모든 트랙이 피아노(프로그램 0)이고 드럼 채널(10번)을 쓰지 않는다', () => {
    for (const t of midi.tracks) {
      expect(t.instrument.number).toBe(0)
      expect(t.instrument.family).toBe('piano')
      expect(t.channel).not.toBe(9)
      expect(t.instrument.percussion).toBe(false)
    }
    // 프로그램 변경 이벤트(0xC0|채널, 0)가 트랙마다 실제로 기록되어 있다
    const changes = [...bytes].filter((b, i) => b >= 0xc0 && b <= 0xcf && bytes[i + 1] === 0 && b !== 0xc9)
    expect(changes.length).toBeGreaterThanOrEqual(2)
  })

  it('템포·박자·조성이 설정대로 들어가고 조표가 올바르게 읽힌다', async () => {
    expect(midi.header.tempos[0].bpm).toBeCloseTo(90)
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([3, 4])
    const r = await readMidiFile(new File([bytes as BlobPart], 'p.mid'))
    if (!r.ok) throw new Error('읽기 실패')
    expect(r.info.keySignatures[0]).toMatchObject({ fifths: -3, scale: 'minor', tonic: 'C' })
  })

  it('한글 트랙 이름이 다시 읽어도 그대로이고, 다시 읽으면 모두 음높이 악기다', async () => {
    const r = await readMidiFile(new File([bytes as BlobPart], 'p.mid'))
    if (!r.ok) throw new Error('읽기 실패')
    expect(r.info.tracks.map((t) => t.name)).toEqual(['Melody', '베이스'])
    expect(r.info.tracks.every((t) => t.kind === 'pitched')).toBe(true)
  })

  it('설정에서 템포를 바꾸면 MIDI에도 반영된다', () => {
    const m = new Midi(buildPianoMidi(src, applySettings(src, { tempo: 140 })))
    expect(m.header.tempos).toHaveLength(1)
    expect(m.header.tempos[0].bpm).toBeCloseTo(140)
  })

  it('PPQ가 다른 원본도 같은 박 위치로 환산한다', () => {
    const hi = {
      ...src,
      ppq: 960,
      tracks: [
        {
          ...melody,
          notes: melody.notes.map((n) => ({ ...n, ticks: n.ticks * 2, durationTicks: n.durationTicks * 2 })),
        },
      ],
    }
    const m = new Midi(buildPianoMidi(hi, applySettings(hi)))
    expect(m.tracks[0].notes.map((n) => n.ticks)).toEqual(melody.notes.map((n) => n.ticks))
  })
})

describe('ZIP (buildZip)', () => {
  it('압축을 풀면 원래 내용이 그대로이고 한글 파일 이름이 유지된다', () => {
    const zip = buildZip([
      { name: '곡 이름.pdf', data: new Uint8Array([1, 2, 3]) },
      { name: '곡 이름.musicxml', data: new TextEncoder().encode('<x/>') },
    ])
    const files = unzipSync(zip)
    expect(Object.keys(files).sort()).toEqual(['곡 이름.musicxml', '곡 이름.pdf'])
    expect([...files['곡 이름.pdf']]).toEqual([1, 2, 3])
  })

  it('한글 이름은 UTF-8 표시(일반 목적 비트 11)가 켜져 윈도우 탐색기에서도 깨지지 않는다', () => {
    const zip = buildZip([{ name: '한글.txt', data: new Uint8Array([1]) }])
    const flags = zip[6] | (zip[7] << 8) // 첫 로컬 파일 헤더의 일반 목적 비트
    expect(flags & 0x0800).toBe(0x0800)
  })

  it('같은 이름이 있으면 (1), (2)를 붙여 구분한다', () => {
    const files = unzipSync(
      buildZip([
        { name: 'a.pdf', data: new Uint8Array([1]) },
        { name: 'a.pdf', data: new Uint8Array([2]) },
        { name: 'a.pdf', data: new Uint8Array([3]) },
      ]),
    )
    expect(Object.keys(files).sort()).toEqual(['a (1).pdf', 'a (2).pdf', 'a.pdf'])
    expect([...files['a (1).pdf']]).toEqual([2])
  })
})

describe('오류 안내 (기획서 11.3장)', () => {
  it('음표가 하나도 없는 파일과 드럼만 있는 파일을 구분해서 알린다', () => {
    const empty = info([track(0, 'e', [], { kind: 'empty' })])
    expect(() => buildInstrumentScore(empty, applySettings(empty))).toThrow('음표가 없는 파일입니다.')
    const onlyDrums = info([drums])
    expect(buildInstrumentScore(onlyDrums, applySettings(onlyDrums)).model.parts[0].percussion).toBe(true)
  })
})

describe('분리형 한글(NFD) 제목 처리', () => {
  const jamo = (s: string) => Array.from(s).filter((c) => c >= 'ᄀ' && c <= 'ᇿ').length
  it('입력한 제목·작곡자가 분리형이어도 합쳐진 형태로 쓴다', () => {
    const s = applySettings(info([melody]), {
      title: '멀티트랙'.normalize('NFD'),
      composer: '아이티해결단'.normalize('NFD'),
    })
    expect(s.title).toBe('멀티트랙')
    expect(s.composer).toBe('아이티해결단')
  })

  it('분리형 파일 이름으로 만든 악보의 제목에 분리된 자모가 없다 (PDF·Finale 제목이 깨지지 않게)', () => {
    const src = info([melody], { fileName: '01_멀티트랙_드럼_3박자_Eb장조.mid'.normalize('NFC') })
    const res = buildInstrumentScore(src, applySettings(src))
    expect(jamo(res.xml)).toBe(0)
    expect(res.xml).toContain('<work-title>01_멀티트랙_드럼_3박자_Eb장조</work-title>')
  })
})

describe('템포 절반·두 배 후보 (tempoAlternatives)', () => {
  it('지금 템포의 절반과 두 배를 반올림해서 돌려준다', () => {
    expect(tempoAlternatives(70)).toEqual({ half: 35, double: 140 })
    expect(tempoAlternatives(75)).toEqual({ half: 38, double: 150 })
  })
  it('허용 범위(20~400)를 벗어나는 쪽은 null이다', () => {
    expect(tempoAlternatives(30)).toEqual({ half: null, double: 60 })
    expect(tempoAlternatives(300)).toEqual({ half: 150, double: null })
    expect(tempoAlternatives(NaN)).toEqual({ half: null, double: null })
  })
})

describe('PDF 쪽 맞춤 (fitZoom)', () => {
  // 그림 높이가 크기에 비례하는 가짜 악보
  const run = (heightAtOne: number, start = 1) => {
    const tried: number[] = []
    const zoom = fitZoom(start, (z) => (tried.push(z), heightAtOne * z))
    return { zoom, tried }
  }

  it('이미 들어가면 고른 크기 그대로 한 번만 그린다', () => {
    expect(run(0.8)).toEqual({ zoom: 1, tried: [1] })
  })

  it('넘치면 한 쪽에 들어갈 때까지 줄이고, 마지막에 그린 크기를 쓴다', () => {
    const r = run(2.4, 1.3)
    expect(2.4 * r.zoom).toBeLessThanOrEqual(PAGE_FILL_LIMIT)
    expect(r.tried.at(-1)).toBe(r.zoom)
  })

  it('아무리 커도 정해진 횟수 안에 끝난다', () => {
    expect(run(1000).tried.length).toBeLessThanOrEqual(9)
  })
})

describe('PDF 마디 배치와 쪽 제목', () => {
  const part = (id: string, n: number) =>
    `<part id="${id}">${Array.from({ length: n }, (_, i) => `<measure number="${i + 1}"><note/></measure>`).join('')}</part>`

  it('마디 수는 첫 파트로, 보표 수는 두 보표 파트를 2로 센다', () => {
    const xml = part('P1', 10) + '<staves>2</staves>' + part('P2', 10)
    expect(measureCount(xml)).toBe(10)
    expect(staffCount(xml)).toBe(3)
  })

  it('제목을 읽고(특수문자 포함), 길면 …로 줄인다', () => {
    expect(workTitle('<work><work-title>A &amp; B &lt;다&gt;</work-title></work>')).toBe('A & B <다>')
    expect(ellipsize('abcdef', 4, (s) => s.length)).toBe('abc…')
    expect(ellipsize('abc', 4, (s) => s.length)).toBe('abc')
  })
})
