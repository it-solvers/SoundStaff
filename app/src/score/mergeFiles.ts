import { prettyTonic, tonicName } from '../midi/keys'
import type { MidiFileInfo, TrackInfo } from '../midi/types'
import { t } from '../text'
import { baseName } from '../utils/fileName'

export interface MergeResult {
  info: MidiFileInfo
  warnings: string[]
}

const tempoText = (f: MidiFileInfo) => `${Math.round((f.tempos[0]?.bpm ?? 120) * 10) / 10} BPM`
const sigText = (f: MidiFileInfo) => `${f.timeSignatures[0]?.numerator ?? 4}/${f.timeSignatures[0]?.denominator ?? 4}`
const keyText = (f: MidiFileInfo) => {
  const k = f.keySignatures[0]
  return k ? t.keys.name(prettyTonic(tonicName(k.fifths, k.scale)), k.scale === 'minor') : t.keys.noSignature
}

/**
 * 첨부한 여러 파일을 곡 하나로 모은다 (기획서 8.4 출력 단위 (A)).
 * 템포·박자·조성은 첫 번째 파일 기준으로 맞추고, 다르면 경고를 돌려준다.
 * PPQ(4분음표당 틱 수)가 다른 파일은 첫 번째 파일의 PPQ로 환산해 같은 박 위치에 놓는다.
 * 파일이 하나뿐이면 그대로 돌려준다.
 */
export function mergeFiles(files: MidiFileInfo[]): MergeResult {
  if (files.length === 1) return { info: files[0], warnings: [] }
  const base = files[0]
  const warnings: string[] = []

  const tracks: TrackInfo[] = files.flatMap((f) => {
    const ratio = base.ppq / f.ppq
    const prefix = baseName(f.fileName)
    return f.tracks.map((tr) => ({
      ...tr,
      name: `${prefix}: ${tr.name || tr.instrumentName || `${tr.index + 1}`}`,
      notes:
        ratio === 1
          ? tr.notes
          : tr.notes.map((n) => ({
              ...n,
              ticks: Math.round(n.ticks * ratio),
              durationTicks: Math.round(n.durationTicks * ratio),
            })),
    }))
  })
  tracks.forEach((tr, i) => (tr.index = i))

  for (const f of files.slice(1)) {
    const name = baseName(f.fileName)
    if (f.tempos[0] && base.tempos[0] && Math.abs(f.tempos[0].bpm - base.tempos[0].bpm) > 0.5) {
      warnings.push(t.warnings.merge.tempo(name, tempoText(f), tempoText(base)))
    }
    if (sigText(f) !== sigText(base)) warnings.push(t.warnings.merge.timeSignature(name, sigText(f), sigText(base)))
    const a = f.keySignatures[0]
    const b = base.keySignatures[0]
    if (a && b && (a.fifths !== b.fifths || a.scale !== b.scale))
      warnings.push(t.warnings.merge.key(name, keyText(f), keyText(base)))
  }

  return {
    info: {
      ...base,
      id: 'merged',
      fileName: `${t.files.andMore(baseName(base.fileName), files.length - 1)}.mid`,
      size: files.reduce((a, f) => a + f.size, 0),
      durationSec: Math.max(...files.map((f) => f.durationSec)),
      tracks,
    },
    warnings,
  }
}
