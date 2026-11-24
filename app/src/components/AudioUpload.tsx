import { useRef, useState } from 'react'
import { AUDIO_EXTENSIONS } from '../audio/format'
import { t } from '../text'

interface Props {
  /** 폰·태블릿이면 메뉴를 숨기고 PC 이용 안내만 보여 준다 (기획서 6.1장) */
  phone: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
}

/** 음원(mp3, wav 등) 분석 첨부 영역. PC 전용이며 정확도가 낮을 수 있다는 경고를 항상 함께 보여 준다. */
export default function AudioUpload({ phone, disabled, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  if (phone) {
    return (
      <p
        className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300"
        data-testid="audio-phone-notice"
      >
        {t.audio.phone}
      </p>
    )
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files))
      }}
      // MIDI 첨부 카드와 같은 모양 (점선 테두리, 가운데 정렬, 같은 높이)
      className={`flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        dragging ? 'border-sky-400 bg-sky-950' : 'border-slate-700 bg-slate-900'
      }`}
      data-testid="audio-upload"
    >
      <p className="text-base font-medium text-slate-100">
        {t.audio.heading} <span className="text-sm font-normal text-slate-400">({t.audio.pcOnly})</span>
      </p>
      <p className="mt-1 text-sm text-slate-400">{t.audio.hint}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="mt-4 rounded-lg bg-slate-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
        data-testid="audio-button"
      >
        {t.audio.button}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={AUDIO_EXTENSIONS.map((e) => `.${e}`).join(',') + ',audio/*'}
        className="hidden"
        data-testid="audio-input"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** 두 첨부 카드 위에 보여 주는 음원 정확도 경고 (PC 전용) */
export function AudioNotes({ phone }: { phone: boolean }) {
  if (phone) return null
  return (
    <div data-testid="audio-notes">
      <p className="rounded-lg bg-amber-900/40 px-3 py-2 text-sm text-amber-200" data-testid="audio-warning">
        {t.audio.warningGeneric}
      </p>
    </div>
  )
}
