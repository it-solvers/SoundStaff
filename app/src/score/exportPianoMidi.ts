import { Midi } from '@tonejs/midi'
import type { MidiFileInfo } from '../midi/types'
import type { ScoreSettings } from './types'

const OUT_PPQ = 480 // @tonejs/midi로 새로 만드는 파일의 기본 해상도
/** 드럼 전용인 10번 채널(번호 9)을 뺀 채널 목록 */
const CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15]

/** MIDI 텍스트는 인코딩 규격이 없어서 라이브러리가 글자 코드를 그대로 바이트로 쓴다. 한글이 깨지지 않게 UTF-8 바이트를 글자로 바꿔 넘긴다. */
const asUtf8Bytes = (s: string) => String.fromCharCode(...new TextEncoder().encode(s))

/**
 * 모든 음높이 악기를 피아노(Acoustic Grand Piano, 프로그램 0)로 통일한 MIDI를 만든다. (기획서 4.1장 7번)
 * - 원본의 음표를 그대로 쓴다 (악보용 양자화·피아노 합치기를 거치지 않으므로 음이 빠지지 않는다).
 * - 드럼 트랙은 제외한다. 남겨 두면 피아노로 통일했는데도 드럼 소리가 나기 때문이다.
 * - 템포·박자·조성은 악보 설정(사용자가 고친 값 포함)을 따른다.
 */
export function buildPianoMidi(info: MidiFileInfo, settings: ScoreSettings): Uint8Array {
  const ratio = OUT_PPQ / info.ppq
  const m = new Midi()
  for (const t of [...settings.tempos].sort((a, b) => a.ticks - b.ticks)) {
    m.header.tempos.push({ ticks: Math.round(t.ticks * ratio), bpm: t.bpm })
  }
  for (const s of [...settings.timeSignatures].sort((a, b) => a.ticks - b.ticks)) {
    m.header.timeSignatures.push({ ticks: Math.round(s.ticks * ratio), timeSignature: [s.numerator, s.denominator] })
  }
  // 라이브러리의 조표 쓰기 기능에 오류가 있어서, 자리만 만들고 조표 바이트는 아래에서 직접 쓴다.
  m.header.keySignatures.push({ ticks: 0, key: 'C', scale: 'major' })
  m.header.update()

  info.tracks
    .filter((t) => t.kind === 'pitched')
    .forEach((src, i) => {
      const t = m.addTrack()
      t.name = asUtf8Bytes(src.name || src.instrumentName || `${i + 1}`)
      t.channel = CHANNELS[i % CHANNELS.length]
      t.instrument.number = 0
      for (const n of src.notes) {
        t.addNote({
          midi: n.midi,
          ticks: Math.round(n.ticks * ratio),
          durationTicks: Math.max(1, Math.round(n.durationTicks * ratio)),
          velocity: n.velocity,
        })
      }
    })

  const bytes = new Uint8Array(m.toArray())
  // 조표 메타 이벤트 FF 59 02 sf mi 의 값을 올바르게 고친다 (sf: 플랫 음수·샵 양수, mi: 0 장조 / 1 단조)
  for (let i = 0; i + 4 < bytes.length; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0x59 && bytes[i + 2] === 0x02) {
      bytes[i + 3] = settings.key.fifths & 0xff
      bytes[i + 4] = settings.key.mode === 'minor' ? 1 : 0
      break
    }
  }
  return bytes
}
