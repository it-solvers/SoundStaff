import { strToU8, zipSync } from 'fflate'
import { uniqueName } from '../utils/fileName'
import type { PdfSettings } from './pdfSettings'
import { buildPianoMidi } from './exportPianoMidi'
import type { MidiFileInfo } from '../midi/types'
import type { BuildResult, ScoreSettings } from './types'

export interface ZipEntry {
  name: string
  data: Uint8Array
}

/** 여러 파일을 하나의 ZIP으로 묶는다. 이름이 겹치면 "이름 (1).확장자"로 구분한다. (한글 파일 이름은 UTF-8로 기록된다) */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const used = new Set<string>()
  const files: Record<string, Uint8Array> = {}
  for (const e of entries) files[uniqueName(e.name, used)] = e.data
  return zipSync(files, { level: 6 })
}

export interface ZipItem {
  /** ZIP 안 파일 이름의 바탕 (확장자 없음) */
  base: string
  info: MidiFileInfo
  settings: ScoreSettings
  result: BuildResult
}

/** 출력 단위 (B)의 전체 ZIP: 파일마다 PDF + MusicXML + 피아노 MIDI */
export async function buildResultZip(
  items: ZipItem[],
  pdf: PdfSettings,
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const entries: ZipEntry[] = []
  onProgress(0, items.length)
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    // PDF 라이브러리는 무거워서 실제로 만들 때 불러온다 (첫 화면 로딩을 가볍게)
    const { exportScorePdf } = await import('./exportPdf')
    const pdfBlob = await exportScorePdf(it.result.xml, pdf)
    entries.push(
      { name: `${it.base}.pdf`, data: new Uint8Array(await pdfBlob.arrayBuffer()) },
      { name: `${it.base}.musicxml`, data: strToU8(it.result.xml) },
      { name: `${it.base} 피아노.mid`, data: buildPianoMidi(it.info, it.settings) },
    )
    onProgress(i + 1, items.length)
  }
  return buildZip(entries)
}
