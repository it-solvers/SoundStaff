import '../../src/workers/shim'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { detectNotes } from '../../src/audio/noteDetect'
import { filterNotes, mergeRepeatedNotes } from '../../src/audio/notes'
import { refineNotes, type RefineTuning } from '../../src/audio/spectrum'
import type { AudioNote } from '../../src/midi/types'
import { buildPieces } from './pieces'
import { score } from './score'
import { render, SR } from './synth'

/** 보정 조정값을 여러 가지로 바꿔 가며 곡 유형별 점수를 비교한다. AI 결과는 곡마다 저장해 두고 다시 쓴다. */
const MODEL_DIR = new URL('../../public/basic-pitch-model/', import.meta.url).pathname
const CACHE = new URL('../../node_modules/.cache/typebench/', import.meta.url).pathname

let server: Server
let modelUrl = ''
beforeAll(async () => {
  server = createServer((req, res) => {
    const file = MODEL_DIR + (req.url ?? '/').split('?')[0].replace(/^\//, '')
    if (!existsSync(file)) {
      res.statusCode = 404
      return res.end()
    }
    res.setHeader('Connection', 'close')
    res.end(readFileSync(file))
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  const a = server.address()
  modelUrl = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}/model.json`
})
afterAll(() => server?.close())

const CONFIGS: [string, RefineTuning | null][] = [
  ['AI만 (보정 없음)', null],
  ['지금 값', {}],
  ['빠진 음 안 넣기', { addMissing: false }],
  ['넣기 5프레임(0.46초)', { minAddFrames: 5 }],
  ['넣기 8프레임(0.74초)', { minAddFrames: 8 }],
  ['들림 기준 0.4', { audibleRatio: 0.4 }],
  ['들림 기준 0.55', { audibleRatio: 0.55 }],
  ['5프레임 + 기준 0.4', { minAddFrames: 5, audibleRatio: 0.4 }],
  ['8프레임 + 기준 0.55', { minAddFrames: 8, audibleRatio: 0.55 }],
  ['빼기 강화(0.15)', { weakRatio: 0.15 }],
  ['5프레임 + 기준 0.4 + 빼기 0.15', { minAddFrames: 5, audibleRatio: 0.4, weakRatio: 0.15 }],
]

it('보정 조정값 비교', async () => {
  mkdirSync(CACHE, { recursive: true })
  const pieces = buildPieces()
  const pcms: Float32Array[] = []
  const raws: AudioNote[][] = []
  for (const [i, p] of pieces.entries()) {
    const pcm = render(p.notes)
    pcms.push(pcm)
    const file = `${CACHE}ai-${i}.json`
    if (existsSync(file)) raws.push(JSON.parse(readFileSync(file, 'utf8')))
    else {
      const { raw } = await detectNotes(pcm, modelUrl, () => {})
      writeFileSync(file, JSON.stringify(raw))
      raws.push(raw)
    }
  }
  const lines: string[] = [
    '| 설정 | 피아노 한 줄 | 피아노 여러 음 | 악기 달라짐 | 전체 음높이 F1 | 전체 시작 F1 | 전체 군더더기 |',
    '|---|---|---|---|---|---|---|',
  ]
  for (const [name, tuning] of CONFIGS) {
    const res = pieces.map((p, i) => {
      const filtered = filterNotes(raws[i])
      const notes = tuning ? refineNotes(pcms[i], SR, filtered, undefined, tuning).notes : filtered
      return score(p.notes, mergeRepeatedNotes(notes))
    })
    const mean = (idx: number[], k: 'pitch' | 'onset' | 'extra') => idx.reduce((a, i) => a + res[i][k], 0) / idx.length
    const of = (g: string) => pieces.flatMap((p, i) => (p.group === g ? [i] : []))
    const all = pieces.map((_, i) => i)
    const pc = (x: number) => `${Math.round(x * 100)}%`
    lines.push(
      `| ${name} | ${pc(mean(of('피아노 한 줄'), 'pitch'))} | ${pc(mean(of('피아노 여러 음'), 'pitch'))} | ${pc(mean(of('악기 소리 달라짐'), 'pitch'))} | ${pc(mean(all, 'pitch'))} | ${pc(mean(all, 'onset'))} | ${pc(mean(all, 'extra'))} |`,
    )
  }
  console.log('\n' + lines.join('\n'))
  writeFileSync(`${CACHE}sweep.md`, lines.join('\n'))
  expect(lines.length).toBeGreaterThan(2)
}, 3_600_000)
