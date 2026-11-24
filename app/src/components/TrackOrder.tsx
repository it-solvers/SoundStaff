import { useState } from 'react'
import type { MidiFileInfo, TrackInfo } from '../midi/types'
import { moveItem, orderBy, sameOrder } from '../score/trackOrder'
import { t } from '../text'

/** 이 목록에서 바꾸는 값들. undefined는 "바꾸지 않음(원래대로)" */
export interface TrackPatch {
  trackOrder?: number[]
  excludedTracks?: number[]
  mutedTracks?: number[]
}

interface Props {
  info: MidiFileInfo
  order?: number[]
  /** 악보에서 뺀 악기 */
  excluded?: number[]
  /** 재생할 때 소리를 끈 악기 */
  muted?: number[]
  onChange: (patch: TrackPatch) => void
  /** false면 순서를 바꾸지 못한다 (피아노 대보표: 오른손이 위, 왼손이 아래로 고정) */
  reorder?: boolean
}

/** 소리 켜짐: 스피커 + 소리 물결 / 꺼짐: 스피커 + ✕ (이모지는 작고 흐릿해서 구분이 어려워 그림으로 직접 그린다) */
function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-testid={on ? 'icon-sound-on' : 'icon-sound-off'}
    >
      <path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" stroke="none" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      ) : (
        <path d="M16 9l6 6M22 9l-6 6" />
      )}
    </svg>
  )
}

const label = (tr: TrackInfo) => tr.name || tr.instrumentName || `${t.trackOrder.track} ${tr.index + 1}`
const btn =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-200 disabled:opacity-30'
// 마우스를 올렸을 때 배경: 반투명 회색이라 어두운·밝은 화면 모두에서 글자가 보인다 (slate-700 같은 진한 색은 밝은 화면에서 글자와 같은 색이 된다)
const hoverNormal = 'hover:bg-slate-500/20 disabled:hover:bg-transparent'
const hoverMuted = 'hover:bg-amber-900'

/**
 * 악기(트랙)별 설정: 악보에서 쌓이는 순서(끌어서 옮기기·▲▼), 재생할 때 소리 끄기(스피커 버튼), 악보에서 빼기(✕).
 * 바꾸면 이미 만든 악보가 새 설정으로 다시 만들어진다. 빼기는 [다시 넣기]로 되돌린다.
 */
export default function TrackOrder({ info, order, excluded, muted, onChange, reorder = true }: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const tracks = info.tracks.filter((tr) => tr.kind === 'pitched')
  if (tracks.length < 2) return null

  const original = tracks.map((tr) => tr.index)
  const removed = new Set(excluded ?? [])
  const mutedSet = new Set(muted ?? [])
  const ordered = orderBy(tracks, (tr) => tr.index, order)
  const active = ordered.filter((tr) => !removed.has(tr.index))
  const gone = ordered.filter((tr) => removed.has(tr.index))
  const changed =
    !sameOrder(
      ordered.map((tr) => tr.index),
      original,
    ) ||
    removed.size > 0 ||
    mutedSet.size > 0

  const norm = (list: number[]) => (list.length ? list : undefined)
  /** 보이는(뺀 것 제외) 목록 안에서 옮긴다. 뺀 악기는 순서 목록의 맨 뒤에 둔다 */
  const move = (from: number, to: number) => {
    const next = [...moveItem(active, from, to), ...gone].map((tr) => tr.index)
    onChange({ trackOrder: sameOrder(next, original) ? undefined : next })
  }
  const toggleMute = (index: number) => {
    const next = new Set(mutedSet)
    if (!next.delete(index)) next.add(index)
    onChange({ mutedTracks: norm([...next]) })
  }
  const remove = (index: number) => {
    const next = new Set(removed).add(index)
    const m = new Set(mutedSet)
    m.delete(index) // 뺀 악기의 "소리 끄기"는 의미가 없으므로 같이 정리한다
    onChange({ excludedTracks: [...next], mutedTracks: norm([...m]) })
  }
  const restore = (index: number) => {
    const next = new Set(removed)
    next.delete(index)
    onChange({ excludedTracks: norm([...next]) })
  }

  return (
    <div className="mt-5" data-testid="track-order">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t.trackOrder.heading}</h4>
        {changed && (
          <button
            type="button"
            className="inline-flex min-h-9 items-center px-1 text-xs text-slate-400 underline hover:text-slate-100"
            onClick={() => onChange({ trackOrder: undefined, excludedTracks: undefined, mutedTracks: undefined })}
            data-testid="track-order-reset"
          >
            {t.trackOrder.reset}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">{reorder ? t.trackOrder.hint : t.trackOrder.hintFixed}</p>
      <ol className="mt-2 space-y-1.5">
        {active.map((tr, i) => {
          const isMuted = mutedSet.has(tr.index)
          const onlyOne = active.length === 1
          return (
            <li
              key={tr.index}
              draggable={reorder}
              onDragStart={(e) => {
                setDragFrom(i)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(tr.index)) // Firefox는 데이터를 넣어야 끌기가 시작된다
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return
                e.preventDefault()
                setDragOver(i)
              }}
              onDragLeave={() => setDragOver((cur) => (cur === i ? null : cur))}
              onDrop={(e) => {
                e.preventDefault()
                if (dragFrom !== null) move(dragFrom, i)
                setDragFrom(null)
                setDragOver(null)
              }}
              onDragEnd={() => {
                setDragFrom(null)
                setDragOver(null)
              }}
              className={`flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
                dragOver === i && dragFrom !== null && dragFrom !== i
                  ? 'border-sky-400 bg-sky-950'
                  : 'border-slate-700 bg-slate-800/60'
              } ${dragFrom === i ? 'opacity-50' : ''}`}
              data-testid="track-order-item"
              data-track-index={tr.index}
              data-muted={isMuted ? 'true' : 'false'}
            >
              <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                {reorder && (
                  <span
                    className="cursor-grab select-none px-1 text-slate-400"
                    aria-hidden="true"
                    title={t.trackOrder.handle}
                    data-testid="track-order-handle"
                  >
                    ⠿
                  </span>
                )}
                {reorder && (
                  <span className="w-5 shrink-0 text-center text-xs tabular-nums text-slate-400">{i + 1}</span>
                )}
                <span className="min-w-0 flex-1 break-all">
                  <span className={isMuted ? 'text-slate-400 line-through decoration-1' : ''}>
                    {label(tr)} <span className="text-xs text-slate-400">· {t.trackOrder.notes(tr.noteCount)}</span>
                  </span>
                  {isMuted && (
                    <span className="ml-1 text-xs text-amber-300" data-testid="track-muted-badge">
                      {t.trackOrder.mutedBadge}
                    </span>
                  )}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  className={`${btn} ${isMuted ? `border-amber-500 bg-amber-950 text-amber-200 ${hoverMuted}` : hoverNormal}`}
                  aria-pressed={isMuted}
                  aria-label={`${label(tr)} ${isMuted ? t.trackOrder.unmute : t.trackOrder.mute}`}
                  title={isMuted ? t.trackOrder.unmute : t.trackOrder.mute}
                  onClick={() => toggleMute(tr.index)}
                  data-testid={`track-mute-${tr.index}`}
                >
                  <SpeakerIcon on={!isMuted} />
                </button>
                {reorder && (
                  <button
                    type="button"
                    className={`${btn} ${hoverNormal}`}
                    disabled={i === 0}
                    aria-label={`${label(tr)} ${t.trackOrder.up}`}
                    onClick={() => move(i, i - 1)}
                    data-testid={`track-up-${tr.index}`}
                  >
                    ▲
                  </button>
                )}
                {reorder && (
                  <button
                    type="button"
                    className={`${btn} ${hoverNormal}`}
                    disabled={i === active.length - 1}
                    aria-label={`${label(tr)} ${t.trackOrder.down}`}
                    onClick={() => move(i, i + 1)}
                    data-testid={`track-down-${tr.index}`}
                  >
                    ▼
                  </button>
                )}
                <button
                  type="button"
                  className={`${btn} ${hoverNormal}`}
                  disabled={onlyOne}
                  aria-label={`${label(tr)} ${t.trackOrder.remove}`}
                  title={onlyOne ? t.trackOrder.keepOne : t.trackOrder.remove}
                  onClick={() => remove(tr.index)}
                  data-testid={`track-remove-${tr.index}`}
                >
                  ✕
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      {gone.length > 0 && (
        <div className="mt-3" data-testid="track-removed">
          <h5 className="text-xs font-semibold text-slate-300">{t.trackOrder.removedHeading}</h5>
          <ul className="mt-1.5 space-y-1.5">
            {gone.map((tr) => (
              <li
                key={tr.index}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-700 px-2 py-1.5 text-sm text-slate-400"
                data-testid="track-removed-item"
                data-track-index={tr.index}
              >
                <span className="min-w-0 flex-1 basis-48 break-all line-through decoration-1">
                  {label(tr)} · {t.trackOrder.notes(tr.noteCount)}
                </span>
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center rounded-lg border border-slate-700 px-3 text-xs text-slate-200 hover:bg-slate-500/20"
                  onClick={() => restore(tr.index)}
                  data-testid={`track-restore-${tr.index}`}
                >
                  {t.trackOrder.restore}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
