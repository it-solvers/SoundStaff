import '../../src/workers/shim' // window 없는 환경에서 AI 라이브러리가 멈추지 않게 (반드시 먼저)
import { createServer, type Server } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { detectNotes } from '../../src/audio/noteDetect'
import { filterNotes, mergeRepeatedNotes } from '../../src/audio/notes'
import { refineNotes } from '../../src/audio/spectrum'
import { estimateBpmFromAudio } from '../../src/audio/tempo'
import { estimateKey } from '../../src/audio/key'
import { tonicName } from '../../src/midi/keys'
import type { AudioNote } from '../../src/midi/types'
import { buildPieces } from './pieces'
import { render, SR } from './synth'

/** 시험 환경 값: 분석 때 쓰는 앱 코드는 그대로이고, 소리만 합성이다 */
const ONSET_TOLERANCE = 0.08
const GRID = 0.05
const MODEL_DIR = new URL('../../public/basic-pitch-model/', import.meta.url).pathname
const OUT_DIR = new URL('../../../output/', import.meta.url).pathname

interface Score {
  /** 프레임별 음높이 F1 (옥타브까지 맞아야 함) */
  pitch: number
  /** 프레임별 음이름 F1 (옥타브 무시) */
  chroma: number
  /** 음 시작 F1: 같은 높이의 음이 ±80ms 안에 시작 */
  onset: number
  /** 정답 음 중 못 찾은 비율 */
  miss: number
  /** 찾은 음 중 정답에 없는 비율 */
  extra: number
  count: number
}

const f1 = (p: number, r: number) => (p + r ? (2 * p * r) / (p + r) : 0)

function frameSets(
  notes: { midi: number; start: number; end: number }[],
  frames: number,
  chroma: boolean,
): Set<number>[] {
  const sets = Array.from({ length: frames }, () => new Set<number>())
  for (const n of notes) {
    const a = Math.ceil(n.start / GRID - 0.5)
    const b = Math.floor(n.end / GRID - 0.5)
    for (let i = Math.max(0, a); i <= Math.min(frames - 1, b); i++) sets[i].add(chroma ? n.midi % 12 : n.midi)
  }
  return sets
}

function score(truth: { midi: number; start: number; dur: number }[], found: AudioNote[]): Score {
  const T = truth.map((n) => ({ midi: n.midi, start: n.start, end: n.start + n.dur }))
  const D = found.map((n) => ({ midi: n.midi, start: n.startSec, end: n.startSec + n.durationSec }))
  const frames = Math.ceil(Math.max(...T.map((n) => n.end), ...D.map((n) => n.end)) / GRID) + 1
  const frameF1 = (chroma: boolean) => {
    const a = frameSets(T, frames, chroma)
    const b = frameSets(D, frames, chroma)
    let tp = 0
    let na = 0
    let nb = 0
    for (let i = 0; i < frames; i++) {
      na += a[i].size
      nb += b[i].size
      for (const x of a[i]) if (b[i].has(x)) tp++
    }
    return f1(nb ? tp / nb : 0, na ? tp / na : 0)
  }
  // 음 시작 맞추기: 같은 높이에서 시작 시각이 가장 가까운 것끼리 하나씩 짝짓는다
  const used = new Set<number>()
  let hit = 0
  for (const t of T) {
    let best = -1
    let bestD = ONSET_TOLERANCE + 1e-9
    D.forEach((d, i) => {
      if (used.has(i) || d.midi !== t.midi) return
      const dist = Math.abs(d.start - t.start)
      if (dist < bestD) {
        bestD = dist
        best = i
      }
    })
    if (best >= 0) {
      used.add(best)
      hit++
    }
  }
  const prec = D.length ? hit / D.length : 0
  const rec = T.length ? hit / T.length : 0
  return {
    pitch: frameF1(false),
    chroma: frameF1(true),
    onset: f1(prec, rec),
    miss: 1 - rec,
    extra: 1 - prec,
    count: D.length,
  }
}

let server: Server
let modelUrl = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    const file = MODEL_DIR + (req.url ?? '/').split('?')[0].replace(/^\//, '')
    if (!existsSync(file)) {
      res.statusCode = 404
      return res.end()
    }
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Connection', 'close') // 연결을 재사용하지 않는다 (재사용하면 두 번째 곡부터 ECONNRESET)
    res.end(readFileSync(file))
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  const addr = server.address()
  modelUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/model.json`
})
afterAll(() => server?.close())

const pct = (x: number) => `${Math.round(x * 100)}%`

it('곡 유형별 음원 분석 정확도', async () => {
  const only = process.env.TYPEBENCH_ONLY
  const pieces = buildPieces().filter((p) => !only || p.name.includes(only))
  const rows: string[] = []
  const summary: { group: string; r: Score }[] = []
  for (const p of pieces) {
    const pcm = render(p.notes)
    const { raw } = await detectNotes(pcm, modelUrl, () => {})
    const filtered = filterNotes(raw)
    const refined = refineNotes(pcm, SR, filtered).notes
    const shown = mergeRepeatedNotes(refined) // 화면에 나오는 "들리는 대로" 음표
    const r = score(p.notes, shown)
    const aiOnly = score(p.notes, mergeRepeatedNotes(filtered))
    const bpm = estimateBpmFromAudio(pcm, SR)
    const key = estimateKey(shown)
    summary.push({ group: p.group, r })
    rows.push(
      `| ${p.name} | ${p.notes.length} | ${r.count} | ${pct(r.pitch)} | ${pct(r.chroma)} | ${pct(r.onset)} | ${pct(r.miss)} | ${pct(r.extra)} | ${pct(aiOnly.pitch)} | ${bpm ? Math.round(bpm.value) : '-'} (정답 ${p.bpm}) | ${tonicName(key.value.fifths, key.value.mode)} ${key.value.mode === 'minor' ? '단조' : '장조'} |`,
    )
    console.log(rows[rows.length - 1])
  }
  const avg = (rs: Score[], k: keyof Score) => rs.reduce((a, r) => a + (r[k] as number), 0) / rs.length
  const groups = [...new Set(summary.map((s) => s.group))].map((g) => {
    const rs = summary.filter((s) => s.group === g).map((s) => s.r)
    return `| ${g} | ${rs.length} | ${pct(avg(rs, 'pitch'))} | ${pct(avg(rs, 'chroma'))} | ${pct(avg(rs, 'onset'))} | ${pct(avg(rs, 'miss'))} | ${pct(avg(rs, 'extra'))} |`
  })
  const md = [
    '# 곡 유형별 음원 분석 정확도 (합성 시험곡)',
    '',
    '- 정답: 코드로 만든 시험곡의 음표. 소리: 앱의 피아노 샘플(실제 피아노 녹음)과 더하기 합성 현악·플루트.',
    '- 분석: 앱과 같은 순서(AI 찾기 → 거르기 → 주파수 보정 → 같은 음 합치기). 템포·조성은 같은 코드로 추정.',
    '- 합성음은 실제 AI 작곡 음원보다 깨끗하므로 **실제 점수는 이보다 낮게** 나온다. 유형 간 상대 비교용이다.',
    '',
    '| 곡 유형 | 정답 음 수 | 찾은 음 수 | 음높이 F1 | 음이름 F1 | 시작 F1 | 놓침 | 군더더기 | (AI만) 음높이 F1 | 추정 템포 | 추정 조 |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## 계열별 평균',
    '',
    '| 계열 | 곡 수 | 음높이 F1 | 음이름 F1 | 시작 F1 | 놓침 | 군더더기 |',
    '|---|---|---|---|---|---|---|',
    ...groups,
    '',
  ].join('\n')
  let path = `${OUT_DIR}유형별 정확도 시험.md`
  for (let i = 1; existsSync(path); i++) path = `${OUT_DIR}유형별 정확도 시험 (${i}).md`
  writeFileSync(path, md)
  console.log(`\n${md}\n저장: ${path}`)
  expect(rows.length).toBeGreaterThan(0)
}, 3_600_000)
