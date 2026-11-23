import { useEffect, useRef, useState } from 'react'
import { t } from '../text/ko'

interface Props {
  disabled?: boolean
  /** 폰·태블릿이면 MIDI만 받는다 (음원 분석은 PC 전용) */
  phone?: boolean
  onFiles: (files: File[]) => void
}

export default function UploadZone({ disabled, phone, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // 창의 다른 곳에 놓아도 브라우저가 파일을 열어 버리지 않도록 막는다.
  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
    }
  }, [])

  const pick = (list: FileList | null) => {
    if (!list || list.length === 0) return
    onFiles(Array.from(list))
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
        if (!disabled) pick(e.dataTransfer.files)
      }}
      className={`flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        dragging ? 'border-sky-400 bg-sky-950' : 'border-slate-700 bg-slate-900'
      }`}
    >
      <p className="text-base font-medium text-slate-100">{phone ? t.upload.dropMidiOnly : t.upload.drop}</p>
      <p className="mt-1 text-sm text-slate-400">{phone ? t.upload.hintMidiOnly : t.upload.hint}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="mt-4 rounded-lg bg-slate-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
      >
        {t.upload.button}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={
          phone ? '.mid,.midi,audio/midi,audio/x-midi' : '.mid,.midi,audio/midi,audio/x-midi,.mp3,.wav,.m4a,.ogg,.flac'
        }
        className="hidden"
        data-testid="midi-input"
        onChange={(e) => {
          pick(e.target.files)
          e.target.value = '' // 같은 파일을 다시 선택해도 동작하도록 초기화
        }}
      />
    </div>
  )
}
