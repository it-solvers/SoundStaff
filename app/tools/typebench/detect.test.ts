import '../../src/workers/shim'
import { execFileSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch'
import { trackBeats, usefulBeatTimes } from '../../src/audio/beats'
import { estimateKey } from '../../src/audio/key'
import { selectMelody } from '../../src/audio/melody'
import { detectPosteriors, type Posteriors } from '../../src/audio/noteDetect'
import { MIN_NOTE_SECONDS, mergeRepeatedNotes } from '../../src/audio/notes'
import { refineNotes } from '../../src/audio/spectrum'
import { estimateBpmFromAudio, estimateBpmFromNotes } from '../../src/audio/tempo'
import { audioToInfo } from '../../src/audio/toInfo'
import type { AudioNote } from '../../src/midi/types'
import { buildScore } from '../../src/score/buildScore'
import { applySettings } from '../../src/score/settings'
import { buildPieces } from './pieces'
import { score } from './score'
import { readWav, render, SR } from './synth'

/** AI가 음을 찾는 기준값(온셋·프레임 확률, 최소 길이, 최소 세기)을 바꿔 가며 합성 곡과 실제 곡을 함께 잰다. AI가 낸 확률은 저장해 재사용한다. */
const MODEL_DIR = new URL('../../public/basic-pitch-model/', import.meta.url).pathname
const DATA = new URL('../../../data/', import.meta.url).pathname
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

interface Cfg {
  name: string
  onset: number
  frame: number
  minLen: number
  minConf: number
}
const CONFIGS: Cfg[] = [
  { name: '지금 값', onset: 0.5, frame: 0.3, minLen: 5, minConf: 0.25 },
  { name: '세기 기준 0.15', onset: 0.5, frame: 0.3, minLen: 5, minConf: 0.15 },
  { name: '프레임 0.2', onset: 0.5, frame: 0.2, minLen: 5, minConf: 0.25 },
  { name: '프레임 0.2 + 세기 0.15', onset: 0.5, frame: 0.2, minLen: 5, minConf: 0.15 },
  { name: '온셋 0.4', onset: 0.4, frame: 0.3, minLen: 5, minConf: 0.25 },
  { name: '온셋 0.4 + 세기 0.15', onset: 0.4, frame: 0.3, minLen: 5, minConf: 0.15 },
  { name: '온셋 0.4 + 프레임 0.2', onset: 0.4, frame: 0.2, minLen: 5, minConf: 0.25 },
  { name: '온셋 0.4 + 프레임 0.2 + 세기 0.15', onset: 0.4, frame: 0.2, minLen: 5, minConf: 0.15 },
  { name: '온셋 0.3', onset: 0.3, frame: 0.3, minLen: 5, minConf: 0.25 },
  { name: '온셋 0.3 + 프레임 0.2 + 세기 0.15', onset: 0.3, frame: 0.2, minLen: 5, minConf: 0.15 },
  { name: '최소 길이 3', onset: 0.5, frame: 0.3, minLen: 3, minConf: 0.25 },
  { name: '온셋 0.4 + 최소 길이 3', onset: 0.4, frame: 0.3, minLen: 3, minConf: 0.25 },
  { name: '온셋 0.6', onset: 0.6, frame: 0.3, minLen: 5, minConf: 0.25 },
  { name: '프레임 0.4 + 세기 0.35', onset: 0.5, frame: 0.4, minLen: 5, minConf: 0.35 },
]

const toNotes = (p: Posteriors, c: Cfg): AudioNote[] =>
  noteFramesToTime(outputToNotesPoly(p.frames, p.onsets, c.onset, c.frame, c.minLen))
    .map((e) => ({
      startSec: e.startTimeSeconds,
      durationSec: e.durationSeconds,
      midi: e.pitchMidi,
      velocity: e.amplitude,
    }))
    .filter((n) => n.durationSec >= MIN_NOTE_SECONDS && n.velocity >= c.minConf)
    .sort((a, b) => a.startSec - b.startSec || b.midi - a.midi)

async function posteriorsFor(key: string, pcm: Float32Array): Promise<Posteriors> {
  const file = `${CACHE}post-${key}.json`
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const p = await detectPosteriors(pcm, modelUrl, () => {})
  writeFileSync(file, JSON.stringify(p))
  return p
}

it('AI 찾기 기준값 비교', async () => {
  mkdirSync(CACHE, { recursive: true })
  const xmlDir = process.env.TYPEBENCH_XML_DIR
  if (xmlDir) mkdirSync(xmlDir, { recursive: true })
  const pieces = buildPieces()
  const pcms = pieces.map((p) => render(p.notes))
  const posts = await Promise.all(pcms.map((pcm, i) => posteriorsFor(String(i), pcm)))
  const wavName = readdirSync(DATA).find((f) => f.endsWith('.wav'))
  let real: { pcm: Float32Array; post: Posteriors } | null = null
  if (wavName) {
    const wav = `${CACHE}real.wav`
    if (!existsSync(wav))
      execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${SR}`, '-c', '1', `${DATA}${wavName}`, wav])
    const pcm = readWav(wav).data
    real = { pcm, post: await posteriorsFor('real', pcm) }
  }
  const pc = (x: number) => `${Math.round(x * 100)}%`
  const lines = [
    '| 설정 | 피아노 한 줄 | 피아노 여러 음 | 악기 달라짐 | 합성 전체 음높이 F1 | 놓침 | 군더더기 | 실제 곡 음 수 |',
    '|---|---|---|---|---|---|---|---|',
  ]
  for (const [ci, c] of CONFIGS.entries()) {
    const res = pieces.map((p, i) =>
      score(p.notes, mergeRepeatedNotes(refineNotes(pcms[i], SR, toNotes(posts[i], c)).notes)),
    )
    const mean = (idx: number[], k: 'pitch' | 'miss' | 'extra') => idx.reduce((a, i) => a + res[i][k], 0) / idx.length
    const of = (g: string) => pieces.flatMap((p, i) => (p.group === g ? [i] : []))
    const all = pieces.map((_, i) => i)
    let realCount = '-'
    if (real && xmlDir) {
      const refined = refineNotes(real.pcm, SR, toNotes(real.post, c)).notes
      realCount = String(mergeRepeatedNotes(refined).length)
      const fromAudio = estimateBpmFromAudio(real.pcm, SR)
      const bpm =
        fromAudio && fromAudio.confidence >= 0.1
          ? fromAudio
          : estimateBpmFromNotes(
              refined.map((n) => n.startSec),
              refined.map((n) => n.velocity * Math.sqrt(n.durationSec)),
            )
      let beatTimes: number[] | undefined
      try {
        beatTimes = usefulBeatTimes(trackBeats(real.pcm, SR, bpm.value), bpm.value) ?? undefined
      } catch {
        beatTimes = undefined
      }
      const info = audioToInfo({
        fileName: 'real.wav',
        size: 1,
        durationSec: real.pcm.length / SR,
        notes: selectMelody(refined),
        allNotes: refined,
        detectedCount: refined.length,
        bpm,
        beatTimes,
        key: estimateKey(refined),
        backend: 'cpu',
        elapsedMs: 0,
      })
      writeFileSync(
        `${xmlDir}/${String(ci).padStart(2, '0')}_${c.name.replace(/[^\w가-힣.]+/g, '_')}.musicxml`,
        buildScore(info, applySettings(info)).xml,
      )
    }
    lines.push(
      `| ${c.name} | ${pc(mean(of('피아노 한 줄'), 'pitch'))} | ${pc(mean(of('피아노 여러 음'), 'pitch'))} | ${pc(mean(of('악기 소리 달라짐'), 'pitch'))} | ${pc(mean(all, 'pitch'))} | ${pc(mean(all, 'miss'))} | ${pc(mean(all, 'extra'))} | ${realCount} |`,
    )
  }
  console.log('\n' + lines.join('\n'))
  writeFileSync(`${CACHE}detect.md`, lines.join('\n'))
  expect(lines.length).toBeGreaterThan(2)
}, 3_600_000)
