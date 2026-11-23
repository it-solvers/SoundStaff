import { useState } from 'react'
import { baseName } from '../score/buildScore'
import { exportScorePdf } from '../score/exportPdf'
import type { BuildResult } from '../score/types'
import { downloadBlob, safeFileName } from '../utils/download'
import ScoreView from './ScoreView'

export interface PanelItem {
  id: string
  fileName: string
  result: BuildResult
}

/** 첨부 영역 하단: 악보 미리보기 + PDF·MusicXML 다운로드 (파일이 여럿이면 탭) */
export default function ScorePanel({
  items,
  selectedId,
  onSelect,
}: {
  items: PanelItem[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const item = items.find((i) => i.id === selectedId) ?? items[0]
  if (!item) return null
  const base = safeFileName(baseName(item.fileName))

  async function pdf() {
    setBusy(true)
    setError('')
    try {
      downloadBlob(await exportScorePdf(item.result.xml), `${base}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function musicXml() {
    downloadBlob(new Blob([item.result.xml], { type: 'application/vnd.recordare.musicxml+xml' }), `${base}.musicxml`)
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" data-testid="score-panel">
      <h2 className="text-base font-semibold">악보 미리보기</h2>
      {items.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              role="tab"
              aria-selected={i.id === item.id}
              onClick={() => onSelect(i.id)}
              className={`rounded-full border px-3 py-1 text-sm ${i.id === item.id ? 'border-sky-500 bg-sky-950 text-sky-100' : 'border-slate-700 text-slate-300'}`}
            >
              {baseName(i.fileName)}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3">
        <ScoreView key={item.id} xml={item.result.xml} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={pdf}
          disabled={busy}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
          data-testid="download-pdf"
        >
          {busy ? 'PDF 만드는 중…' : 'PDF 다운로드'}
        </button>
        <button
          type="button"
          onClick={musicXml}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          data-testid="download-musicxml"
        >
          MusicXML 다운로드
        </button>
      </div>
      {error && (
        <p
          className="mt-3 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-200"
          role="alert"
          data-testid="pdf-error"
        >
          PDF를 만들지 못했습니다: {error}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-400">
        MusicXML(뮤직엑스엠엘, 악보 교환용 표준 파일 형식)은 Finale(피날레, 악보 제작 프로그램)에서 파일 → 열기(또는
        가져오기)로 불러옵니다. Finale는 PC에서만 쓸 수 있으므로 폰에서 받았다면 PC로 옮겨서 여세요. 자동 변환
        결과이므로 Finale에서 확인하고 고쳐 주세요.
      </p>
    </section>
  )
}
