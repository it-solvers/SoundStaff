import { describe, expect, it } from 'vitest'
import { classifyTrack } from '../src/midi/classify'
import { MAX_MIDI_BYTES, decodeMidiText, readMidiFile } from '../src/midi/readMidi'
import { midiBytes } from './helpers'

const file = (bytes: Uint8Array | string, name = 'test.mid') => new File([bytes as BlobPart], name)

describe('MIDI 읽기 (readMidiFile)', () => {
  it('트랙·템포·박자·조성·음표를 읽는다', async () => {
    const bytes = midiBytes(
      (m) => {
        m.header.setTempo(96)
        m.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4] })
        const t = m.addTrack()
        t.name = 'Lead'
        t.addNote({ midi: 60, ticks: 0, durationTicks: 480, velocity: 0.8 })
        t.addNote({ midi: 64, ticks: 480, durationTicks: 480, velocity: 0.8 })
      },
      { sf: -3, minor: false },
    )
    const r = await readMidiFile(file(bytes))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.info.tempos[0].bpm).toBeCloseTo(96)
    expect(r.info.timeSignatures[0]).toMatchObject({ numerator: 3, denominator: 4 })
    expect(r.info.keySignatures[0]).toMatchObject({ fifths: -3, scale: 'major', tonic: 'Eb' })
    expect(r.info.tracks[0]).toMatchObject({
      name: 'Lead',
      noteCount: 2,
      kind: 'pitched',
      lowestMidi: 60,
      highestMidi: 64,
    })
  })

  it('단조는 같은 조표 수의 나란한 단조 이름(C 단조)으로 표시한다', async () => {
    const bytes = midiBytes((m) => m.addTrack().addNote({ midi: 60, ticks: 0, durationTicks: 480 }), {
      sf: -3,
      minor: true,
    })
    const r = await readMidiFile(file(bytes))
    if (!r.ok) throw new Error('읽기 실패')
    expect(r.info.keySignatures[0]).toMatchObject({ fifths: -3, scale: 'minor', tonic: 'C' })
  })

  it('조표가 없으면 비어 있다 (임의로 C장조를 만들어 내지 않는다)', async () => {
    const r = await readMidiFile(
      file(midiBytes((m) => m.addTrack().addNote({ midi: 60, ticks: 0, durationTicks: 480 }))),
    )
    if (!r.ok) throw new Error('읽기 실패')
    expect(r.info.keySignatures).toEqual([])
    expect(r.info.tempos).toEqual([])
  })

  it('10번 채널(드럼) 트랙은 drum, 음표 없는 트랙은 empty로 분류한다', async () => {
    const bytes = midiBytes((m) => {
      const a = m.addTrack()
      a.addNote({ midi: 60, ticks: 0, durationTicks: 480 })
      const d = m.addTrack()
      d.channel = 9
      d.addNote({ midi: 36, ticks: 0, durationTicks: 100 })
      m.addTrack()
    })
    const r = await readMidiFile(file(bytes))
    if (!r.ok) throw new Error('읽기 실패')
    expect(r.info.tracks.map((t) => t.kind)).toEqual(['pitched', 'drum', 'empty'])
  })

  it('MIDI가 아닌 확장자, 빈 파일, 5MB 초과, 손상된 파일은 파일별 오류를 돌려준다', async () => {
    const bad = async (f: File) => {
      const r = await readMidiFile(f)
      expect(r.ok).toBe(false)
      return r.ok ? '' : r.error
    }
    expect(await bad(file('x', 'a.txt'))).toContain('지원하는 형식: mid, midi')
    expect(await bad(file(new Uint8Array(0), 'a.mid'))).toContain('빈 파일')
    expect(await bad(file(new Uint8Array(MAX_MIDI_BYTES + 1), 'a.mid'))).toContain('5MB')
    expect(await bad(file('not a midi file at all', 'a.mid'))).toContain('읽을 수 없습니다')
  })

  it('확장자는 대소문자를 가리지 않고 .midi도 받는다', async () => {
    const bytes = midiBytes((m) => m.addTrack().addNote({ midi: 60, ticks: 0, durationTicks: 480 }))
    expect((await readMidiFile(file(bytes, 'A.MID'))).ok).toBe(true)
    expect((await readMidiFile(file(bytes, 'a.midi'))).ok).toBe(true)
  })
})

describe('트랙 분류 (classifyTrack)', () => {
  it('음표가 없으면 empty, 채널 10이나 타악기면 drum, 나머지는 pitched', () => {
    expect(classifyTrack({ channelIndex: 0, percussion: false, noteCount: 0 })).toBe('empty')
    expect(classifyTrack({ channelIndex: 9, percussion: false, noteCount: 3 })).toBe('drum')
    expect(classifyTrack({ channelIndex: 2, percussion: true, noteCount: 3 })).toBe('drum')
    expect(classifyTrack({ channelIndex: 2, percussion: false, noteCount: 3 })).toBe('pitched')
  })
})

describe('MIDI 텍스트 인코딩 복원 (decodeMidiText)', () => {
  const asLatin1 = (bytes: Uint8Array) => String.fromCharCode(...bytes)
  it('UTF-8 한글 이름이 바이트 그대로 읽혀 깨졌을 때 복원한다', () => {
    expect(decodeMidiText(asLatin1(new TextEncoder().encode('멜로디')))).toBe('멜로디')
  })
  it('EUC-KR(CP949) 한글 이름도 복원한다', () => {
    const euckr = new Uint8Array([0xb8, 0xe1, 0xb7, 0xce, 0xb5, 0xf0]) // "멜로디"
    expect(decodeMidiText(asLatin1(euckr))).toBe('멜로디')
  })
  it('순수 영문과 이미 정상인 한글은 그대로 둔다', () => {
    expect(decodeMidiText('Piano')).toBe('Piano')
    expect(decodeMidiText('멜로디')).toBe('멜로디')
    expect(decodeMidiText('')).toBe('')
  })
})
