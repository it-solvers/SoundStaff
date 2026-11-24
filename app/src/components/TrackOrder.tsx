import { useState } from 'react'
import type { MidiFileInfo, TrackInfo } from '../midi/types'
import { moveItem, orderBy, sameOrder } from '../score/trackOrder'
import { t } from '../text/ko'

interface Props {
  info: MidiFileInfo
  /** 사용자가 정한 순서(트랙 번호 목록). 없으면 원래 순서 */
  order?: number[]
  /** 새 순서. 원래 순서와 같아지면 undefined(= 바꾸지 않음) */
  onChange: (order: number[] | undefined) => void
}

const label = (tr: TrackInfo) => tr.name || tr.instrumentName || `${t.trackOrder.track} ${tr.index + 1}`
const btn =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent'

/**
 * 악보에서 악기(트랙) 단을 위에서 아래로 쌓는 순서를 정한다.
 * 끌어서 옮기거나(PC) ▲▼ 버튼(폰·키보드)으로 옮기면 이미 만든 악보가 새 순서로 다시 만들어진다.
 */
export default function TrackOrder({ info, order, onChange }: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const tracks = info.tracks.filter((tr) => tr.kind === 'pitched')
  if (tracks.length < 2) return null

  const original = tracks.map((tr) => tr.index)
  const ordered = orderBy(tracks, (tr) => tr.index, order)
  const changed = !sameOrder(
    ordered.map((tr) => tr.index),
    original,
  )
  const move = (from: number, to: number) => {
    const next = moveItem(ordered, from, to).map((tr) => tr.index)
    onChange(sameOrder(next, original) ? undefined : next)
  }

  return (
    <div className="mt-5" data-testid="track-order">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t.trackOrder.heading}</h4>
        {changed && (
          <button
            type="button"
            className="inline-flex min-h-9 items-center px-1 text-xs text-slate-400 underline hover:text-slate-100"
            onClick={() => onChange(undefined)}
            data-testid="track-order-reset"
          >
            {t.trackOrder.reset}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">{t.trackOrder.hint}</p>
      <ol className="mt-2 space-y-1.5">
        {ordered.map((tr, i) => (
          <li
            key={tr.index}
            draggable
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
            className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
              dragOver === i && dragFrom !== null && dragFrom !== i
                ? 'border-sky-400 bg-sky-950'
                : 'border-slate-700 bg-slate-800/60'
            } ${dragFrom === i ? 'opacity-50' : ''}`}
            data-testid="track-order-item"
            data-track-index={tr.index}
          >
            <span
              className="cursor-grab select-none px-1 text-slate-400"
              aria-hidden="true"
              title={t.trackOrder.handle}
              data-testid="track-order-handle"
            >
              ⠿
            </span>
            <span className="w-5 shrink-0 text-center text-xs tabular-nums text-slate-400">{i + 1}</span>
            <span className="min-w-0 flex-1 break-all">
              {label(tr)} <span className="text-xs text-slate-400">· {t.trackOrder.notes(tr.noteCount)}</span>
            </span>
            <button
              type="button"
              className={btn}
              disabled={i === 0}
              aria-label={`${label(tr)} ${t.trackOrder.up}`}
              onClick={() => move(i, i - 1)}
              data-testid={`track-up-${tr.index}`}
            >
              ▲
            </button>
            <button
              type="button"
              className={btn}
              disabled={i === ordered.length - 1}
              aria-label={`${label(tr)} ${t.trackOrder.down}`}
              onClick={() => move(i, i + 1)}
              data-testid={`track-down-${tr.index}`}
            >
              ▼
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
