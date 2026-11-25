import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { MidiFileInfo } from '../midi/types'
import {
  DEFAULT_PDF_SETTINGS,
  type PdfLayout,
  type PdfOrientation,
  type PdfSettings,
  type PdfSize,
} from '../score/pdfSettings'
import type { BuildResult, ScoreSettings } from '../score/types'
import { t } from '../text'
import { reportError } from '../utils/errors'
import DownloadButtons from './DownloadButtons'

// 악보 그리기 라이브러리(OSMD)는 무거워서 악보가 처음 나올 때 불러온다 (첫 화면 로딩을 가볍게)
const ScoreView = lazy(() => import('./ScoreView'))

export interface PanelItem {
  id: string
  /** 탭에 보이는 이름 */
  label: string
  /** 다운로드 파일 이름의 바탕 (확장자 없음) */
  base: string
  info: MidiFileInfo
  settings: ScoreSettings
  result: BuildResult
  /** 이 악보에 대한 안내 문구 (음원 분석 결과의 "주 멜로디만" 안내 등) */
  note?: string[]
}

interface Props {
  items: PanelItem[]
  selectedId: string
  onSelect: (id: string) => void
  /** 출력 단위 (B)일 때만 전체 ZIP을 제공한다 */
  showZip: boolean
}

const zipButton =
  'rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50'
const select = 'rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100'

/** 첨부 영역 하단: 악보 미리보기, PDF 설정, 다운로드 (파일이 여럿이면 탭) */
export default function ScorePanel({ items, selectedId, onSelect, showZip }: Props) {
  const [pdf, setPdf] = useState<PdfSettings>(DEFAULT_PDF_SETTINGS)
  const [error, setError] = useState('')
  const [zipProgress, setZipProgress] = useState<[number, number] | null>(null)
  const [zip, setZip] = useState<{ url: string; name: string; signature: string } | null>(null)
  const item = items.find((i) => i.id === selectedId) ?? items[0]
  // 만들 때와 지금의 악보·PDF 설정이 같은지 비교하는 값
  const pdfKey = JSON.stringify(pdf)
  const allSignature = `all:${pdfKey}:${items.map((i) => `${i.id}:${i.base}:${i.result.xml.length}`).join('|')}`
  const partsSignature = item ? `parts:${pdfKey}:${item.id}:${item.base}:${item.result.xml}` : ''
  // 악보가 바뀌면 만들어 둔 ZIP은 낡은 것이므로 링크를 숨긴다
  const zipFresh = zip && (zip.signature === allSignature || zip.signature === partsSignature) ? zip : null
  const zipRef = useRef(zip)
  useEffect(() => {
    zipRef.current = zip
  })
  useEffect(
    () => () => {
      if (zipRef.current) URL.revokeObjectURL(zipRef.current.url)
    },
    [],
  )
  if (!item) return null

  /** ZIP을 만든다. 'all': 파일마다의 악보 전부, 'parts': 지금 보는 악보의 악기별 파트보 */
  async function makeZip(kind: 'all' | 'parts') {
    setError('')
    setZipProgress([0, kind === 'all' ? items.length : item.result.model.parts.length])
    try {
      const { buildResultZip, buildPartsZip } = await import('../score/exportZip')
      const progress = (done: number, total: number) => setZipProgress([done, total])
      const bytes =
        kind === 'all'
          ? await buildResultZip(
              items.map((i) => ({ base: i.base, info: i.info, settings: i.settings, result: i.result })),
              pdf,
              progress,
            )
          : await buildPartsZip(item.result.model, item.base, pdf, progress)
      // 만드는 데 몇 초 걸려서 바로 내려받게 하면 브라우저가 "클릭 없는 자동 다운로드"로 보고 막을 수 있다.
      // 그래서 다 만든 뒤 사용자가 직접 누르는 저장 링크로 넘긴다.
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }))
      setZip((old) => {
        if (old) URL.revokeObjectURL(old.url)
        return kind === 'all'
          ? { url, name: t.panel.zipName(t.appName), signature: allSignature }
          : { url, name: t.panel.partsZipName(item.base), signature: partsSignature }
      })
    } catch (e) {
      setError(t.errors.downloadFailed(reportError(e)))
    } finally {
      setZipProgress(null)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" data-testid="score-panel">
      <h2 className="text-base font-semibold">{t.panel.heading}</h2>
      {items.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              role="tab"
              aria-selected={i.id === item.id}
              onClick={() => onSelect(i.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                i.id === item.id ? 'border-sky-500 bg-sky-950 text-sky-100' : 'border-slate-600 text-slate-300'
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      )}
      {item.note && (
        <p className="mt-3 rounded-lg bg-amber-900/40 px-3 py-2 text-sm text-amber-200" data-testid="panel-note">
          {item.note.join(' ')}
        </p>
      )}
      <div className="mt-3">
        <Suspense fallback={<p className="text-sm text-slate-400">{t.panel.drawing}</p>}>
          <ScoreView key={item.id} xml={item.result.xml} model={item.result.model} />
        </Suspense>
      </div>

      <fieldset className="mt-4 flex flex-wrap items-end gap-4 rounded-lg border border-slate-800 p-3">
        <legend className="px-1 text-xs text-slate-400">{t.panel.pdfSettings}</legend>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-400">{t.panel.orientation}</span>
          <select
            className={select}
            value={pdf.orientation}
            data-testid="pdf-orientation"
            onChange={(e) => setPdf({ ...pdf, orientation: e.target.value as PdfOrientation })}
          >
            <option value="portrait">{t.panel.portrait}</option>
            <option value="landscape">{t.panel.landscape}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-400">{t.panel.size}</span>
          <select
            className={select}
            value={pdf.size}
            data-testid="pdf-size"
            onChange={(e) => setPdf({ ...pdf, size: e.target.value as PdfSize })}
          >
            <option value="small">{t.panel.sizes.small}</option>
            <option value="normal">{t.panel.sizes.normal}</option>
            <option value="large">{t.panel.sizes.large}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-400">{t.panel.layout}</span>
          <select
            className={select}
            value={pdf.layout}
            data-testid="pdf-layout"
            onChange={(e) => setPdf({ ...pdf, layout: e.target.value as PdfLayout })}
          >
            <option value="four">{t.panel.layouts.four}</option>
            <option value="auto">{t.panel.layouts.auto}</option>
          </select>
        </label>
      </fieldset>

      <div className="mt-4">
        <DownloadButtons item={item} pdf={pdf} onError={setError} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {item.result.model.parts.length > 1 && (
            <button
              type="button"
              disabled={zipProgress !== null}
              onClick={() => makeZip('parts')}
              className={zipButton}
              data-testid="download-parts"
            >
              {t.panel.partsZip(item.result.model.parts.length)}
            </button>
          )}
          {showZip && items.length > 1 && (
            <button
              type="button"
              disabled={zipProgress !== null}
              onClick={() => makeZip('all')}
              className={zipButton}
              data-testid="download-zip"
            >
              {t.panel.zip}
            </button>
          )}
          {zipProgress && (
            <span className="text-sm text-slate-300" role="status" data-testid="zip-progress">
              {t.panel.zipBusy(zipProgress[0], zipProgress[1])}
            </span>
          )}
        </div>
        {item.result.model.parts.length > 1 && <p className="mt-2 text-xs text-slate-500">{t.panel.partsHint}</p>}
        {zipFresh && (
          <p className="mt-2 text-sm text-slate-300">
            {t.panel.zipHint}{' '}
            <a
              href={zipFresh.url}
              download={zipFresh.name}
              className="font-medium text-amber-300 underline"
              data-testid="download-zip-save"
            >
              {t.panel.zipReady(zipFresh.name)}
            </a>
          </p>
        )}
      </div>
      {error && (
        <p
          className="mt-3 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-200"
          role="alert"
          data-testid="download-error"
        >
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-500">{t.panel.editorHelp}</p>
    </section>
  )
}
