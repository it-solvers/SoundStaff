import '../../src/workers/shim'
import { execFileSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { detectNotes } from '../../src/audio/noteDetect'
import { filterNotes, mergeRepeatedNotes } from '../../src/audio/notes'
import { audiblePitches, computeSalience, LOW_MIDI, refineNotes, type RefineTuning } from '../../src/audio/spectrum'
import type { AudioNote } from '../../src/midi/types'
import { estimateKey } from '../../src/audio/key'
import { selectMelody } from '../../src/audio/melody'
import { trackBeats, usefulBeatTimes } from '../../src/audio/beats'
import { estimateBpmFromAudio, estimateBpmFromNotes } from '../../src/audio/tempo'
import { audioToInfo } from '../../src/audio/toInfo'
import { buildScore } from '../../src/score/buildScore'
import { applySettings } from '../../src/score/settings'
import { readWav, SR } from './synth'

/** 실제 곡(data/의 합창곡 음원)에서 보정 설정을 소리 기준으로 비교한다. 정답 음표가 없어서 "소리에서 실제 들리는 음"을 기준으로 삼는 근사값이다. */
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

export const CONFIGS: [string, RefineTuning | null][] = [
  ['AI만 (보정 없음)', null],
  ['지금 값', {}],
  ['빠진 음 안 넣기', { addMissing: false }],
  ['넣기 5프레임(0.46초)', { minAddFrames: 5 }],
  ['넣기 8프레임(0.74초)', { minAddFrames: 8 }],
  ['들림 기준 0.55', { audibleRatio: 0.55 }],
  ['5프레임 + 기준 0.4', { minAddFrames: 5, audibleRatio: 0.4 }],
  ['8프레임 + 기준 0.55', { minAddFrames: 8, audibleRatio: 0.55 }],
]

it('실제 곡에서 보정 설정 비교', async () => {
  mkdirSync(CACHE, { recursive: true })
  const wavName = readdirSync(DATA).find((f) => f.endsWith('.wav'))
  if (!wavName) return
  const wav = `${CACHE}real.wav`
  if (!existsSync(wav))
    execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${SR}`, '-c', '1', `${DATA}${wavName}`, wav])
  const { data: pcm } = readWav(wav)
  const rawFile = `${CACHE}ai-real.json`
  let raw: AudioNote[]
  if (existsSync(rawFile)) raw = JSON.parse(readFileSync(rawFile, 'utf8'))
  else {
    raw = (await detectNotes(pcm, modelUrl, () => {})).raw
    writeFileSync(rawFile, JSON.stringify(raw))
  }
  const sal = computeSalience(pcm, SR)
  const xmlDir = process.env.TYPEBENCH_XML_DIR
  if (xmlDir) mkdirSync(xmlDir, { recursive: true })
  const fromAudio = estimateBpmFromAudio(pcm, SR)
  const bpmOf = (all: AudioNote[]) =>
    fromAudio && fromAudio.confidence >= 0.1
      ? fromAudio
      : estimateBpmFromNotes(
          all.map((n) => n.startSec),
          all.map((n) => n.velocity * Math.sqrt(n.durationSec)),
        )
  const filtered = filterNotes(raw)
  const pc = (x: number) => `${Math.round(x * 100)}%`
  const lines = [
    `실제 곡 ${(pcm.length / SR).toFixed(0)}초, AI가 찾은 음 ${raw.length}개`,
    '',
    '| 설정 | 음 수 | 실제 들리는 음 덮음 | 적은 음 중 실제 들림 | 두 값의 F1 |',
    '|---|---|---|---|---|',
  ]
  for (const [ci, [name, tuning]] of CONFIGS.entries()) {
    const refined = tuning ? refineNotes(pcm, SR, filtered, undefined, tuning).notes : filtered
    const notes = mergeRepeatedNotes(refined)
    if (xmlDir) {
      // 앱이 같은 설정(편집용 기본값)으로 만드는 악보를 그대로 만들어 정답 악보 평가 도구에 넘긴다
      const bpm = bpmOf(refined)
      let beatTimes: number[] | undefined
      try {
        beatTimes = usefulBeatTimes(trackBeats(pcm, SR, bpm.value), bpm.value) ?? undefined
      } catch {
        beatTimes = undefined
      }
      const info = audioToInfo({
        fileName: 'real.wav',
        size: 1,
        durationSec: pcm.length / SR,
        notes: selectMelody(refined),
        allNotes: refined,
        detectedCount: raw.length,
        bpm,
        beatTimes,
        key: estimateKey(refined),
        backend: 'cpu',
        elapsedMs: 0,
      })
      writeFileSync(
        `${xmlDir}/${ci}_${name.replace(/[^\w가-힣]+/g, '_')}.musicxml`,
        buildScore(info, applySettings(info)).xml,
      )
    }
    let heard = 0
    let covered = 0
    let written = 0
    let supported = 0
    for (let f = 0; f < sal.times.length; f++) {
      const t = sal.times[f]
      const active = new Set(notes.filter((n) => n.startSec <= t && t <= n.startSec + n.durationSec).map((n) => n.midi))
      const audible = audiblePitches(sal, f)
      for (const m of audible) {
        heard++
        if (active.has(m)) covered++
      }
      for (const m of active) {
        if (m < LOW_MIDI || m > 96) continue
        written++
        if (sal.mag[f][m - LOW_MIDI] >= sal.max[f] * 0.15) supported++
      }
    }
    const r = covered / heard
    const p = supported / written
    lines.push(`| ${name} | ${notes.length} | ${pc(r)} | ${pc(p)} | ${pc((2 * r * p) / (r + p))} |`)
  }
  console.log('\n' + lines.join('\n'))
  writeFileSync(`${CACHE}guard.md`, lines.join('\n'))
  expect(lines.length).toBeGreaterThan(3)
}, 3_600_000)
