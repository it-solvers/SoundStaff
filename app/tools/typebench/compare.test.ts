import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { trackBeats, usefulBeatTimes } from '../../src/audio/beats'
import { estimateKey } from '../../src/audio/key'
import { selectMelody } from '../../src/audio/melody'
import { filterNotes, mergeRepeatedNotes } from '../../src/audio/notes'
import { refineNotes } from '../../src/audio/spectrum'
import { estimateBpmFromAudio, estimateBpmFromNotes } from '../../src/audio/tempo'
import { audioToInfo } from '../../src/audio/toInfo'
import type { AudioNote } from '../../src/midi/types'
import { buildScore } from '../../src/score/buildScore'
import { applySettings } from '../../src/score/settings'
import { buildPieces } from './pieces'
import { score } from './score'
import { readWav, render, SR } from './synth'

/** 다른 모델(예: 파이썬으로 돌린 피아노 전용 모델)의 결과 `export/pN.piano.json`을 지금 앱 방식과 같은 채점으로 비교한다 */
const CACHE = new URL('../../node_modules/.cache/typebench/', import.meta.url).pathname
const pc = (x: number) => `${Math.round(x * 100)}%`

it('다른 모델과 비교', () => {
  const pieces = buildPieces()
  const lines = [
    '| 곡 유형 | 지금 앱 방식 음높이 F1 | AI만 | **피아노 전용 모델** | 시작 F1 (앱 → 전용) | 놓침 (앱 → 전용) | 군더더기 (앱 → 전용) |',
    '|---|---|---|---|---|---|---|',
  ]
  const sums = new Map<string, number[][]>()
  pieces.forEach((p, i) => {
    const file = `${CACHE}export/p${i}.piano.json`
    if (!existsSync(file)) return
    const pcm = render(p.notes)
    const raw: AudioNote[] = JSON.parse(readFileSync(`${CACHE}ai-${i}.json`, 'utf8'))
    const filtered = filterNotes(raw)
    const app = score(p.notes, mergeRepeatedNotes(refineNotes(pcm, SR, filtered).notes))
    const aiOnly = score(p.notes, mergeRepeatedNotes(filtered))
    const piano = score(p.notes, mergeRepeatedNotes(JSON.parse(readFileSync(file, 'utf8')) as AudioNote[]))
    lines.push(
      `| ${p.name} | ${pc(app.pitch)} | ${pc(aiOnly.pitch)} | **${pc(piano.pitch)}** | ${pc(app.onset)} → ${pc(piano.onset)} | ${pc(app.miss)} → ${pc(piano.miss)} | ${pc(app.extra)} → ${pc(piano.extra)} |`,
    )
    const g = sums.get(p.group) ?? []
    g.push([app.pitch, aiOnly.pitch, piano.pitch])
    sums.set(p.group, g)
  })
  lines.push('', '| 계열 | 지금 앱 방식 | AI만 | 피아노 전용 모델 |', '|---|---|---|---|')
  for (const [g, rows] of sums) {
    const m = (k: number) => rows.reduce((a, r) => a + r[k], 0) / rows.length
    lines.push(`| ${g} | ${pc(m(0))} | ${pc(m(1))} | **${pc(m(2))}** |`)
  }
  // 실제 곡: 피아노 전용 모델의 음으로 앱과 같은 방식(편집용)으로 악보를 만들어 정답 악보 평가에 넘긴다
  const xmlDir = process.env.TYPEBENCH_XML_DIR
  const realFile = `${CACHE}export/real.piano.json`
  if (xmlDir && existsSync(realFile)) {
    mkdirSync(xmlDir, { recursive: true })
    const pcm = readWav(`${CACHE}real.wav`).data
    const notes = JSON.parse(readFileSync(realFile, 'utf8')) as AudioNote[]
    const fromAudio = estimateBpmFromAudio(pcm, SR)
    const bpm =
      fromAudio && fromAudio.confidence >= 0.1 ? fromAudio : estimateBpmFromNotes(notes.map((n) => n.startSec))
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
      notes: selectMelody(notes),
      allNotes: notes,
      detectedCount: notes.length,
      bpm,
      beatTimes,
      key: estimateKey(notes),
      backend: 'piano-model',
      elapsedMs: 0,
    })
    writeFileSync(`${xmlDir}/piano_model.musicxml`, buildScore(info, applySettings(info)).xml)
  }
  console.log('\n' + lines.join('\n'))
  writeFileSync(`${CACHE}compare.md`, lines.join('\n'))
  expect(lines.length).toBeGreaterThan(3)
})
