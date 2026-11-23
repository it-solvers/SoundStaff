import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

const PREVIEW_INK = '#e2e8f0'
const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5, 2]

/** MusicXML을 화면에 그린다 (OSMD). 표시 전용이며 편집 기능은 없다. */
export default function ScoreView({ xml }: { xml: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const [zoomIdx, setZoomIdx] = useState(2)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const zoomRef = useRef(ZOOMS[2])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setStatus('loading')
    const osmd = new OpenSheetMusicDisplay(host, {
      autoResize: true,
      drawTitle: true,
      autoBeam: true,
      backend: 'svg',
      // 다크모드: 어두운 배경에서 눈이 편하도록 악보를 밝은 색으로 그린다 (PDF 내보내기에는 영향 없음)
      defaultColorMusic: PREVIEW_INK,
      defaultColorNotehead: PREVIEW_INK,
      defaultColorStem: PREVIEW_INK,
      defaultColorRest: PREVIEW_INK,
      defaultColorLabel: PREVIEW_INK,
      defaultColorTitle: PREVIEW_INK,
    })
    osmdRef.current = osmd
    osmd
      .load(xml)
      .then(() => {
        if (cancelled) return
        osmd.zoom = zoomRef.current
        osmd.render()
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
    return () => {
      cancelled = true
      osmdRef.current = null
      try {
        osmd.clear()
      } catch {
        // 이미 정리된 경우
      }
      host.innerHTML = ''
    }
  }, [xml])

  useEffect(() => {
    zoomRef.current = ZOOMS[zoomIdx]
    const osmd = osmdRef.current
    if (osmd && status === 'ready') {
      osmd.zoom = ZOOMS[zoomIdx]
      osmd.render()
    }
  }, [zoomIdx, status])

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm">
        <button
          type="button"
          disabled={zoomIdx === 0}
          onClick={() => setZoomIdx((i) => i - 1)}
          className="rounded border border-slate-700 px-2.5 py-1 disabled:opacity-40"
          aria-label="축소"
          data-testid="zoom-out"
        >
          −
        </button>
        <span className="w-14 text-center tabular-nums" data-testid="zoom-label">
          {Math.round(ZOOMS[zoomIdx] * 100)}%
        </span>
        <button
          type="button"
          disabled={zoomIdx === ZOOMS.length - 1}
          onClick={() => setZoomIdx((i) => i + 1)}
          className="rounded border border-slate-700 px-2.5 py-1 disabled:opacity-40"
          aria-label="확대"
          data-testid="zoom-in"
        >
          +
        </button>
        {status === 'loading' && <span className="text-slate-400">악보를 그리는 중…</span>}
      </div>
      {status === 'error' && (
        <p className="rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-200" role="alert" data-testid="view-error">
          악보를 화면에 그리지 못했습니다: {error}
        </p>
      )}
      <div className="overflow-auto rounded-lg border border-slate-800 bg-slate-900 p-2" style={{ maxHeight: '75vh' }}>
        <div ref={hostRef} data-testid="score-view" />
      </div>
    </div>
  )
}
