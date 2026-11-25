import { useEffect, useMemo, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { formatClock, ScorePlayer, type PlayState } from '../play/player'
import { DEFAULT_TIMBRE, TIMBRE_IDS, type TimbreId } from '../play/synth'
import { buildTimeline } from '../play/timeline'
import type { ScoreModel } from '../score/types'
import { wrapTitle } from '../score/wrapTitle'
import { t } from '../text'
import { useTheme } from '../theme/theme'

/** 미리보기 악보 색: 어두운 배경에서는 밝게, 밝은 배경에서는 어둡게 */
const INK = { dark: '#e2e8f0', light: '#0f172a' } as const
const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5, 2]

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5]

/** 고른 소리를 이 브라우저에 기억한다 (저장소를 못 쓰는 환경에서는 기억하지 않고 기본 소리를 쓴다) */
const TIMBRE_KEY = 'soundstaff.timbre'
function loadTimbre(): TimbreId {
  try {
    const v = localStorage.getItem(TIMBRE_KEY)
    return TIMBRE_IDS.includes(v as TimbreId) ? (v as TimbreId) : DEFAULT_TIMBRE
  } catch {
    return DEFAULT_TIMBRE
  }
}
function saveTimbre(id: TimbreId) {
  try {
    localStorage.setItem(TIMBRE_KEY, id)
  } catch {
    // 저장하지 못해도 재생에는 영향이 없다
  }
}
/** 재생 커서 색 (밝은 배경·어두운 배경 모두에서 보이는 초록, 반투명) */
const CURSOR = { type: 0, color: '#16a34a', alpha: 0.45, follow: false }

/**
 * 악보를 그린 뒤 긴 곡 제목을 쪽 폭에 맞춰 여러 줄로 나누고, 재생 커서가 멈추는 위치(16분음표 칸)를 모은다.
 * 제목을 나누면 악보 내용이 아래로 내려가므로 커서도 같은 만큼 내린다.
 */
function draw(osmd: OpenSheetMusicDisplay): number[] {
  osmd.render()
  const el = (osmd as unknown as { container?: HTMLElement }).container
  let extra = 0
  el?.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => {
    extra += wrapTitle(svg)
  })
  const cursor = osmd.cursor
  if (!cursor) return []
  cursor.cursorElement.style.marginTop = `${extra}px`
  const steps: number[] = []
  try {
    cursor.reset()
    const it = cursor.Iterator
    while (!it.EndReached) {
      steps.push(it.currentTimeStamp.RealValue * 16)
      it.moveToNext()
    }
    cursor.reset()
    cursor.hide()
  } catch (e) {
    console.error(e)
    return []
  }
  return steps
}

/** MusicXML을 화면에 그리고(OSMD, 표시 전용) 같은 악보를 피아노 소리로 재생한다. */
export default function ScoreView({ xml, model }: { xml: string; model: ScoreModel }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const [zoomIdx, setZoomIdx] = useState(2)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const zoomRef = useRef(ZOOMS[2])
  const { resolved } = useTheme()
  const boxRef = useRef<HTMLDivElement>(null)
  const timeline = useMemo(() => buildTimeline(model), [model])
  const playerRef = useRef<ScorePlayer | null>(null)
  const stepsRef = useRef<number[]>([])
  const cursorIdx = useRef(0)
  const lastPos = useRef(0)
  const [playState, setPlayState] = useState<PlayState>('stopped')
  const [pos, setPos] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [timbre, setTimbre] = useState<TimbreId>(loadTimbre)
  const [notice, setNotice] = useState('')

  /** 지금 재생 위치에 맞는 악보 칸으로 커서를 옮기고, 화면 밖이면 스크롤한다 */
  function moveCursor(sec: number) {
    lastPos.current = sec
    const osmd = osmdRef.current
    const steps = stepsRef.current
    if (!osmd?.cursor || !steps.length) return
    const step = timeline.stepAtSeconds(sec)
    let target = 0
    for (let lo = 0, hi = steps.length - 1; lo <= hi;) {
      const mid = (lo + hi) >> 1
      if (steps[mid] <= step + 1e-6) {
        target = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    if (target < cursorIdx.current) {
      osmd.cursor.reset()
      cursorIdx.current = 0
    }
    if (target === cursorIdx.current) return
    while (cursorIdx.current < target && !osmd.cursor.Iterator.EndReached) {
      osmd.cursor.next()
      cursorIdx.current++
    }
    const box = boxRef.current
    const el = osmd.cursor.cursorElement
    if (box && el) {
      const r = el.getBoundingClientRect()
      const b = box.getBoundingClientRect()
      if (r.top < b.top + 20 || r.bottom > b.bottom - 20) {
        box.scrollTo({ top: box.scrollTop + (r.top - b.top) - 60, behavior: 'smooth' })
      }
    }
  }

  /** 확대·축소나 창 크기 변화로 다시 그린 뒤, 재생 중이면 커서를 현재 위치로 복원한다 */
  function refresh(osmd: OpenSheetMusicDisplay) {
    stepsRef.current = draw(osmd)
    cursorIdx.current = 0
    if (playerRef.current && playerRef.current.state !== 'stopped') {
      osmd.cursor.show()
      moveCursor(lastPos.current)
    }
  }

  function showCursor() {
    const osmd = osmdRef.current
    if (!osmd?.cursor) return
    osmd.cursor.reset()
    cursorIdx.current = 0
    osmd.cursor.show()
  }

  function hideCursor() {
    const osmd = osmdRef.current
    if (!osmd?.cursor) return
    try {
      osmd.cursor.reset()
      osmd.cursor.hide()
    } catch {
      // 악보가 이미 정리된 경우
    }
    cursorIdx.current = 0
  }

  // 효과 안에서도 항상 최신 함수를 부르기 위한 참조
  const api = useRef({ refresh })
  useEffect(() => {
    api.current = { refresh }
  })

  function togglePlay() {
    const p = playerRef.current
    if (p && p.state === 'playing') void p.pause()
    else if (p && p.state === 'paused') void p.resume()
    else if (p && p.state === 'loading')
      return // 소리를 불러오는 중에는 다시 누를 수 없다
    else {
      setNotice('')
      const next = new ScorePlayer(timeline, {
        onTick: (s) => {
          setPos(s)
          moveCursor(s)
        },
        onFallback: () => setNotice(t.panel.fallback),
        onState: (s) => {
          setPlayState(s)
          if (s === 'stopped') hideCursor()
        },
      })
      playerRef.current = next
      showCursor()
      void next.play(speed, timbre)
    }
  }

  function stopPlay() {
    playerRef.current?.stop()
  }

  // 악보가 바뀌거나 화면에서 사라지면 재생을 멈춘다
  useEffect(() => () => playerRef.current?.stop(), [xml, model])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setStatus('loading')
    const ink = INK[resolved]
    const osmd = new OpenSheetMusicDisplay(host, {
      percussionOneLineCutoff: 0, // 타악기도 항상 5줄 보표
      autoResize: false, // 창 크기가 바뀔 때의 다시 그리기는 아래에서 직접 한다 (긴 제목 줄바꿈을 다시 적용해야 하므로)
      drawTitle: true,
      autoBeam: true,
      backend: 'svg',
      // 다크모드: 어두운 배경에서 눈이 편하도록 악보를 밝은 색으로 그린다 (PDF 내보내기에는 영향 없음)
      defaultColorMusic: ink,
      defaultColorNotehead: ink,
      defaultColorStem: ink,
      defaultColorRest: ink,
      defaultColorLabel: ink,
      defaultColorTitle: ink,
      cursorsOptions: [CURSOR],
    })
    osmdRef.current = osmd
    let timer: ReturnType<typeof setTimeout> | undefined
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (osmdRef.current === osmd && !cancelled) api.current.refresh(osmd)
      }, 200)
    }
    window.addEventListener('resize', onResize)
    osmd
      .load(xml)
      .then(() => {
        if (cancelled) return
        osmd.zoom = zoomRef.current
        stepsRef.current = draw(osmd)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        console.error(e)
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
    return () => {
      cancelled = true
      playerRef.current?.stop()
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
      osmdRef.current = null
      try {
        osmd.clear()
      } catch {
        // 이미 정리된 경우
      }
      host.innerHTML = ''
    }
  }, [xml, resolved])

  useEffect(() => {
    zoomRef.current = ZOOMS[zoomIdx]
    const osmd = osmdRef.current
    if (osmd && status === 'ready') {
      osmd.zoom = ZOOMS[zoomIdx]
      api.current.refresh(osmd)
    }
  }, [zoomIdx, status])

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={togglePlay}
          disabled={status !== 'ready' || !timeline.notes.length || playState === 'loading'}
          className="rounded bg-sky-600 px-3 py-1 font-medium text-white hover:bg-sky-700 disabled:opacity-40"
          data-testid="play-toggle"
          data-state={playState}
        >
          {playState === 'loading'
            ? t.panel.loading
            : playState === 'playing'
              ? `⏸ ${t.panel.pause}`
              : playState === 'paused'
                ? `▶ ${t.panel.resume}`
                : `▶ ${t.panel.play}`}
        </button>
        <button
          type="button"
          onClick={stopPlay}
          disabled={playState === 'stopped'}
          className="rounded border border-slate-700 px-3 py-1 disabled:opacity-40"
          data-testid="play-stop"
        >
          ■ {t.panel.stop}
        </button>
        <label className="flex items-center gap-1 text-xs text-slate-400">
          {t.panel.speed}
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            disabled={playState !== 'stopped'}
            className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-sm text-slate-100 disabled:opacity-50"
            data-testid="play-speed"
          >
            {SPEEDS.map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-400">
          {t.panel.timbre}
          <select
            value={timbre}
            onChange={(e) => {
              const next = e.target.value as TimbreId
              setTimbre(next)
              saveTimbre(next)
            }}
            disabled={playState !== 'stopped'}
            className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-sm text-slate-100 disabled:opacity-50"
            data-testid="play-timbre"
          >
            {TIMBRE_IDS.map((id) => (
              <option key={id} value={id}>
                {t.panel.timbres[id]}
              </option>
            ))}
          </select>
        </label>
        <span className="tabular-nums text-xs text-slate-400" data-testid="play-time">
          {formatClock(pos)} / {formatClock(timeline.totalSeconds)}
        </span>
        <span className="mx-1 hidden h-5 w-px bg-slate-700 sm:inline-block" aria-hidden="true" />
        <button
          type="button"
          disabled={zoomIdx === 0}
          onClick={() => setZoomIdx((i) => i - 1)}
          className="rounded border border-slate-700 px-2.5 py-1 disabled:opacity-40"
          aria-label={t.panel.zoomOut}
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
          aria-label={t.panel.zoomIn}
          data-testid="zoom-in"
        >
          +
        </button>
        {status === 'loading' && <span className="text-slate-400">{t.panel.drawing}</span>}
      </div>
      {notice && (
        <p className="mb-2 text-xs text-amber-300" role="status" data-testid="play-notice">
          {notice}
        </p>
      )}
      {status === 'error' && (
        <p className="rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-200" role="alert" data-testid="view-error">
          {t.errors.viewFailed(error)}
        </p>
      )}
      <div
        ref={boxRef}
        className="overflow-auto rounded-lg border border-slate-800 bg-slate-900 p-2"
        style={{ maxHeight: '75vh' }}
      >
        <div ref={hostRef} data-testid="score-view" />
      </div>
    </div>
  )
}
