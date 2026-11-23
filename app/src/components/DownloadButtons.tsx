import { useState } from 'react'
import { musicXmlBlob } from '../score/exportMusicXml'
import type { PdfSettings } from '../score/pdfSettings'
import { buildPianoMidi } from '../score/exportPianoMidi'
import { t } from '../text/ko'
import { downloadBlob } from '../utils/download'
import { reportError } from '../utils/errors'
import type { PanelItem } from './ScorePanel'

interface Props {
  item: PanelItem
  pdf: PdfSettings
  onError: (message: string) => void
}

const primary = 'rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50'

/** [PDF] [MusicXML] [피아노 MIDI] 다운로드 (기획서 4.1장 7번). 모두 이 브라우저 안에서 만든다. */
export default function DownloadButtons({ item, pdf, onError }: Props) {
  const [busy, setBusy] = useState(false)

  async function run(make: () => Promise<void> | void, fail: (msg: string) => string) {
    onError('')
    try {
      await make()
    } catch (e) {
      onError(fail(reportError(e)))
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          className={`${primary} bg-slate-700 hover:bg-slate-600`}
          data-testid="download-pdf"
          onClick={async () => {
            setBusy(true)
            await run(async () => {
              // PDF 라이브러리는 무거워서 실제로 만들 때 불러온다
              const { exportScorePdf } = await import('../score/exportPdf')
              downloadBlob(await exportScorePdf(item.result.xml, pdf), `${item.base}.pdf`)
            }, t.errors.pdfFailed)
            setBusy(false)
          }}
        >
          {busy ? t.panel.pdfBusy : t.panel.pdf}
        </button>
        <button
          type="button"
          className={`${primary} bg-emerald-700 hover:bg-emerald-600`}
          data-testid="download-musicxml"
          onClick={() =>
            run(() => downloadBlob(musicXmlBlob(item.result.xml), `${item.base}.musicxml`), t.errors.downloadFailed)
          }
        >
          {t.panel.musicXml}
        </button>
        <button
          type="button"
          className={`${primary} bg-violet-700 hover:bg-violet-600`}
          data-testid="download-midi"
          onClick={() =>
            run(
              () =>
                downloadBlob(
                  new Blob([buildPianoMidi(item.info, item.settings) as BlobPart], { type: 'audio/midi' }),
                  `${item.base} 피아노.mid`,
                ),
              t.errors.downloadFailed,
            )
          }
        >
          {t.panel.pianoMidi}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{t.panel.pianoMidiHint}</p>
    </div>
  )
}
