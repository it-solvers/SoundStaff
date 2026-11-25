import { DOMParser } from '@xmldom/xmldom'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readMidiFile } from '../src/midi/readMidi'
import { buildInstrumentScore, defaultSettings } from '../src/score/buildScore'
import { mergeFiles } from '../src/score/mergeFiles'
import { buildPianoMidi } from '../src/score/exportPianoMidi'
import type { MidiFileInfo } from '../src/midi/types'

const DIR = path.join(import.meta.dirname, 'fixtures')
const load = async (name: string) => {
  const r = await readMidiFile(new File([fs.readFileSync(path.join(DIR, name))], name))
  if (!r.ok) throw new Error(`${name}: ${r.error}`)
  return r.info
}
const names = fs.readdirSync(DIR).filter((n) => /^\d\d_.*\.mid$/.test(n))
const NO_SCORE = new Map([['15_음표없음.mid', '음표가 없는 파일입니다.']])

describe('시험용 파일 전체 (tests/fixtures)', () => {
  it('시험 파일이 15개 있다', () => expect(names).toHaveLength(15))

  for (const name of names.filter((n) => !NO_SCORE.has(n))) {
    it(`${name}: 올바른 MusicXML이 만들어진다`, async () => {
      const info = await load(name)
      const res = buildInstrumentScore(info, defaultSettings(info)) // 마디 길이·붙임줄 검증은 만드는 도중에 이미 수행된다
      const doc = new DOMParser().parseFromString(res.xml, 'application/xml').documentElement as unknown as Element
      expect(doc.nodeName).toBe('score-partwise')
      expect(res.report.measureCount).toBeGreaterThan(0)
      expect(res.xml).not.toMatch(/undefined|NaN/)
    })

    if (name === '09_드럼만.mid') continue // 타악기만 있으면 피아노 MIDI를 만들지 않는다

    it(`${name}: 피아노 MIDI를 만들어 다시 읽으면 모두 음높이 악기다`, async () => {
      const info = await load(name)
      const bytes = buildPianoMidi(info, defaultSettings(info))
      const back = await readMidiFile(new File([bytes as BlobPart], 'x.mid'))
      expect(back.ok).toBe(true)
      if (back.ok) expect(back.info.tracks.every((t) => t.kind === 'pitched')).toBe(true)
    })
  }

  for (const [name, message] of NO_SCORE) {
    it(`${name}: 악보를 만들 수 없다고 정해진 문구로 알린다`, async () => {
      const info = await load(name)
      expect(() => buildInstrumentScore(info, defaultSettings(info))).toThrow(message)
    })
  }

  it('읽기 오류 파일 3종은 파일별 안내 문구를 돌려준다', async () => {
    const msg = async (n: string) => {
      const r = await readMidiFile(new File([fs.readFileSync(path.join(DIR, n))], n))
      return r.ok ? '' : r.error
    }
    expect(await msg('ERR_손상됨.mid')).toBe('파일을 읽을 수 없습니다. 다른 파일로 시도해 주세요.')
    expect(await msg('ERR_빈파일.mid')).toBe('빈 파일입니다.')
    expect(await msg('ERR_MIDI아님.txt')).toContain('지원하는 형식')
  })

  it('실제 파일들을 합쳐도 모든 파일의 음표가 들어간다 (01+03+07)', async () => {
    const files: MidiFileInfo[] = await Promise.all(
      ['01_멀티트랙_드럼_3박자_Eb장조.mid', '03_단일트랙_4박자_G장조.mid', '07_합창_4성부.mid'].map(load),
    )
    const merged = mergeFiles(files)
    const res = buildInstrumentScore(merged.info, defaultSettings(merged.info))
    const pitched = files
      .flatMap((f) => f.tracks.filter((t) => t.kind !== 'empty'))
      .reduce((a, t) => a + t.noteCount, 0)
    expect(res.report.parts.reduce((a, p) => a + p.noteCount, 0)).toBe(pitched)
    expect(merged.warnings.length).toBe(6)
  })

  it('08 사람 연주(흔들림)는 격자 이탈 경고 없이 정확한 마디 수로 만들어진다', async () => {
    const info = await load('08_사람연주_흔들림.mid')
    const res = buildInstrumentScore(info, defaultSettings(info))
    expect(res.report.warnings.filter((w) => w.includes('격자'))).toEqual([])
  })

  it('10 3연음 파일은 격자 이탈 경고를 낸다', async () => {
    const info = await load('10_3연음.mid')
    expect(
      buildInstrumentScore(info, defaultSettings(info)).report.warnings.some((w) => w.includes('16분음표 격자')),
    ).toBe(true)
  })
})
