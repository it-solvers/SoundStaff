import { useRef } from 'react'
import { AUDIO_EXTENSIONS } from '../audio/format'
import { t } from '../text/ko'

interface Props {
  /** 폰·태블릿이면 메뉴를 숨기고 PC 이용 안내만 보여 준다 (기획서 6.1장) */
  phone: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
}

/** 음원(mp3, wav 등) 분석 첨부 영역. PC 전용이며 정확도가 낮을 수 있다는 경고를 항상 함께 보여 준다. */
export default function AudioUpload({ phone, disabled, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

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
    <section
      className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5"
      data-testid="audio-upload"
    >
      <h2 className="text-base font-semibold">
        {t.audio.heading} <span className="text-sm font-normal text-slate-400">({t.audio.pcOnly})</span>
      </h2>
      <p className="mt-1 text-xs text-slate-400">{t.audio.hint}</p>
      <div className="mt-4">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
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
      <div className="mt-auto pt-4">
        <p className="rounded-lg bg-amber-900/40 px-3 py-2 text-sm text-amber-200" data-testid="audio-warning">
          {t.audio.warning} {t.audio.warningMore}
        </p>
      </div>
    </section>
  )
}
