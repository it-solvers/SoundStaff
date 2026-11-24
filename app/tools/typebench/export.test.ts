import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { buildPieces } from './pieces'
import { render, SR } from './synth'

/** 다른 모델(파이썬 등)로 같은 시험곡을 분석해 볼 수 있게 합성곡을 wav와 정답(JSON)으로 내보낸다 */
const OUT = new URL('../../node_modules/.cache/typebench/export/', import.meta.url).pathname

function wav16(pcm: Float32Array): Buffer {
  const b = Buffer.alloc(44 + pcm.length * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + pcm.length * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(SR, 24)
  b.writeUInt32LE(SR * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(pcm.length * 2, 40)
  pcm.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2))
  return b
}

it('시험곡 내보내기', () => {
  mkdirSync(OUT, { recursive: true })
  const pieces = buildPieces()
  pieces.forEach((p, i) => {
    writeFileSync(`${OUT}p${i}.wav`, wav16(render(p.notes)))
    writeFileSync(`${OUT}p${i}.truth.json`, JSON.stringify({ name: p.name, group: p.group, notes: p.notes }))
  })
  expect(pieces.length).toBeGreaterThan(0)
})
