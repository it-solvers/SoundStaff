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
import { buildPieces } from './pieces'
import { score, type Score } from './score'
import { render, SR } from './synth'

/** 시험 환경 값: 분석 때 쓰는 앱 코드는 그대로이고, 소리만 합성이다 */
const MODEL_DIR = new URL('../../public/basic-pitch-model/', import.meta.url).pathname
const OUT_DIR = new URL('../../../output/', import.meta.url).pathname

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
