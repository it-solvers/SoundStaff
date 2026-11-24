import { useEffect, useRef, useState } from 'react'
import { t } from '../text/ko'
import { COLAB_OPENED_EVENT, type ColabOpenedDetail } from '../colabWindow'
import ColabLink from './ColabLink'
import { COLAB_URL } from '../config'

interface Props {
  disabled?: boolean
  /** Colab에서 받은 MIDI 파일을 첨부하면 바로 악보까지 만든다 */
  onMidi: (files: File[]) => void
}

/**
 * 고품질 변환(Colab) 3단계 안내판. 사용자가 이 화면과 Colab 사이를 오가며 헤매지 않게
 * ① Colab 열기 → ② 받기 → ③ 돌아와서 MIDI 놓기를 한 자리에 모았다.
 * Colab 탭에서 돌아오면(창 포커스) ③번 상자를 강조하고 화면에 보이게 한다.
 */
export default function ColabGuide({ disabled, onMidi }: Props) {
  const [opened, setOpened] = useState(false)
  const [back, setBack] = useState(false)
  const [popupOpen, setPopupOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Colab 링크를 누르면 안내판이 "다녀오는 중" 상태가 된다. 작은 창으로 열렸다면 그 창이 닫히는 순간을 지켜본다.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const mark = (e: Event) => {
      setOpened(true)
      const win = (e as CustomEvent<ColabOpenedDetail>).detail?.win ?? null
      clearInterval(timer)
      if (!win) return
      setPopupOpen(true)
      setBack(false)
      timer = setInterval(() => {
        if (!win.closed) return
        clearInterval(timer)
        setPopupOpen(false)
        setBack(true) // 창을 닫고 돌아왔다: 놓는 상자를 강조하고 화면에 보이게 한다
        dropRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 500)
    }
    window.addEventListener(COLAB_OPENED_EVENT, mark)
    return () => {
      window.removeEventListener(COLAB_OPENED_EVENT, mark)
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!opened) return
    const onReturn = () => {
      if (document.visibilityState === 'hidden') return
      setBack(true)
      dropRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [opened])

  const take = (list: FileList | null) => {
    if (!list || !list.length || disabled) return
    setBack(false)
    setPopupOpen(false)
    onMidi(Array.from(list))
  }
  const circle = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs text-white'

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4" data-testid="colab-guide">
      <h2 className="text-sm font-semibold">{t.colab.guide.heading}</h2>
      <ol className="mt-3 space-y-3 text-sm text-slate-300">
        <li className="flex items-start gap-3">
          <span className={circle}>1</span>
          <div className="space-y-1.5">
            <p>{t.colab.guide.step1}</p>
            <ColabLink />
            {!COLAB_URL && <p className="text-xs text-slate-400">{t.colab.guide.noUrl}</p>}
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className={circle}>2</span>
          <p>{t.colab.guide.step2}</p>
        </li>
        <li className="flex items-start gap-3">
          <span className={circle}>3</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p>{t.colab.guide.step3}</p>
            {popupOpen && (
              <p className="text-xs font-medium text-amber-300" data-testid="colab-waiting">
                {t.colab.guide.waiting}
              </p>
            )}
            <div
              ref={dropRef}
              onDragOver={(e) => {
                e.preventDefault()
                if (!disabled) setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                take(e.dataTransfer.files)
              }}
              onClick={() => !disabled && inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && inputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                dragging || back
                  ? 'border-sky-400 bg-sky-950 ring-2 ring-sky-400/60'
                  : 'border-slate-700 bg-slate-900 hover:border-slate-500'
              } ${disabled ? 'opacity-50' : ''}`}
              data-testid="colab-drop"
              data-highlight={back ? 'true' : 'false'}
            >
              <p className="font-medium text-slate-100">{back ? t.colab.guide.dropBack : t.colab.guide.dropTitle}</p>
              <p className="mt-1 text-xs text-slate-400">{t.colab.guide.dropHint}</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".mid,.midi,audio/midi,audio/x-midi"
                className="hidden"
                data-testid="colab-input"
                onChange={(e) => {
                  take(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        </li>
      </ol>
    </section>
  )
}
