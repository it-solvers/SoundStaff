import { existsSync, writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { estimateBpmFromAudio, estimateBpmFromEnvelope, onsetEnvelope } from '../../src/audio/tempo'
import { buildPieces } from './pieces'
import { readWav, render, SR } from './synth'

/** 같은 시험곡을 여러 템포로 만들어 템포 추정이 정답·절반·두 배·기타 중 어디에 떨어지는지 센다 (AI 없이 소리만 쓰므로 빠르다) */
const BPMS = [60, 70, 80, 90, 100, 110, 120, 130, 140, 150]
const CACHE = new URL('../../node_modules/.cache/typebench/', import.meta.url).pathname

const kind = (est: number, truth: number) => {
  const r = est / truth
  if (Math.abs(r - 1) <= 0.04) return '정답'
  if (Math.abs(r - 0.5) <= 0.03) return '절반'
  if (Math.abs(r - 2) <= 0.08) return '두 배'
  return '기타'
}

it('템포 추정 정답률', () => {
  const only = process.env.TYPEBENCH_ONLY
  const rows: Record<string, number> = { 정답: 0, 절반: 0, '두 배': 0, 기타: 0 }
  const byBpm = new Map<number, Record<string, number>>()
  const bad: string[] = []
  let n = 0
  for (const bpm of BPMS) {
    for (const p of buildPieces(bpm)) {
      if (only && !p.name.includes(only)) continue
      const est = estimateBpmFromAudio(render(p.notes), SR)
      const k = est ? kind(est.value, bpm) : '기타'
      rows[k]++
      n++
      const m = byBpm.get(bpm) ?? { 정답: 0, 절반: 0, '두 배': 0, 기타: 0, 합: 0 }
      m[k]++
      m.합++
      byBpm.set(bpm, m)
      if (k !== '정답') bad.push(`${bpm}→${est?.value} ${p.name}`)
    }
  }
  const pc = (x: number) => `${Math.round((x / n) * 100)}%`
  const lines = [
    `곡 ${n}개 (13유형 × ${BPMS.length}템포): 정답 ${pc(rows['정답'])}, 절반 ${pc(rows['절반'])}, 두 배 ${pc(rows['두 배'])}, 기타 ${pc(rows['기타'])}`,
    '',
    '| 정답 템포 | 정답 | 절반 | 두 배 | 기타 |',
    '|---|---|---|---|---|',
    ...[...byBpm].map(([b, m]) => `| ${b} | ${m['정답']}/${m['합']} | ${m['절반']} | ${m['두 배']} | ${m['기타']} |`),
    '',
    ...bad.map((b) => `- ${b}`),
  ]
  console.log('\n' + lines.join('\n'))
  writeFileSync(`${CACHE}tempo.md`, lines.join('\n'))
  expect(n).toBeGreaterThan(0)
}, 3_600_000)

it('템포 추정 조정값 비교', () => {
  const envs: { bpm: number; env: Float32Array; hopSec: number }[] = []
  for (const bpm of BPMS) {
    for (const p of buildPieces(bpm)) {
      const { env, hopSec } = onsetEnvelope(render(p.notes), SR)
      envs.push({ bpm, env, hopSec })
    }
  }
  const real = existsSync(`${CACHE}real.wav`) ? readWav(`${CACHE}real.wav`).data : null
  const realEnv = real ? onsetEnvelope(real, SR) : null
  const lines = [
    '| 중심(BPM) | 폭(옥타브) | 정답 | 절반 | 두 배 | 기타 | 실제 곡(정답 82) |',
    '|---|---|---|---|---|---|---|',
  ]
  const rows: { center: number; width: number; ok: number; line: string }[] = []
  for (const center of [95, 100, 105, 110, 115, 120, 130]) {
    for (const width of [0.4, 0.5, 0.6, 0.8, 1.0]) {
      const c: Record<string, number> = { 정답: 0, 절반: 0, '두 배': 0, 기타: 0 }
      for (const e of envs) {
        const r = estimateBpmFromEnvelope(e.env, e.hopSec, { priorCenter: center, priorWidth: width })
        c[r ? kind(r.value, e.bpm) : '기타']++
      }
      const rr = realEnv
        ? estimateBpmFromEnvelope(realEnv.env, realEnv.hopSec, { priorCenter: center, priorWidth: width })
        : null
      const pc = (x: number) => `${Math.round((x / envs.length) * 100)}%`
      rows.push({
        center,
        width,
        ok: c['정답'],
        line: `| ${center} | ${width} | ${pc(c['정답'])} | ${pc(c['절반'])} | ${pc(c['두 배'])} | ${pc(c['기타'])} | ${rr?.value ?? '-'} |`,
      })
    }
  }
  rows.sort((a, b) => b.ok - a.ok)
  lines.push(...rows.map((r) => r.line))
  console.log('\n' + lines.join('\n'))
  writeFileSync(`${CACHE}tempo-sweep.md`, lines.join('\n'))
  expect(rows.length).toBeGreaterThan(0)
}, 3_600_000)
