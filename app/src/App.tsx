import { useEffect, useMemo, useRef, useState } from 'react'
import { AnalysisCancelled, analyzeAudioFile } from './audio/analyze'
import { isPhoneOrTablet, readDeviceEnv } from './audio/device'
import { kindOfFile } from './audio/format'
import AnalysisProgress, { type AnalysisState } from './components/AnalysisProgress'
import ThemeToggle from './components/ThemeToggle'
import AudioUpload, { AudioNotes } from './components/AudioUpload'
import ChangeLog from './components/ChangeLog'
import Notices from './components/Notices'
import StepBar from './components/StepBar'
import OptionsPanel from './components/OptionsPanel'
import OutputCard, { type OutputItem } from './components/OutputCard'
import ScorePanel, { type PanelItem } from './components/ScorePanel'
import { type ScoreState } from './components/ScoreResult'
import TrackList from './components/TrackList'
import UploadZone from './components/UploadZone'
import UsageGuide from './components/UsageGuide'
import { readMidiFile } from './midi/readMidi'
import type { MidiFileInfo } from './midi/types'
import { buildScore } from './score/buildScore'
import { mergeFiles } from './score/mergeFiles'
import { applySettings, type SettingsOverride } from './score/settings'
import type { OutputUnit } from './score/types'
import { t } from './text/ko'
import { checkBrowserSupport, reportError } from './utils/errors'
import { baseName, safeFileName } from './utils/fileName'
import { APP_VERSION } from './version'

interface FailedFile {
  fileName: string
  error: string
}

/**
 * 출력 단위에 따라 악보를 만들 단위를 정한다: 합쳐서 하나 / 파일마다 하나.
 * 음원 분석 결과는 MIDI와 템포·박자 기준이 달라 합치지 않고 항상 파일마다 따로 만든다.
 */
function deriveItems(files: MidiFileInfo[], unit: OutputUnit): OutputItem[] {
  const midi = files.filter((f) => f.source !== 'audio')
  const audio = files.filter((f) => f.source === 'audio')
  const audioItems: OutputItem[] = audio.map((f) => ({ id: f.id, label: f.fileName, info: f, warnings: [] }))
  if (unit === 'merged' && midi.length) {
    const m = mergeFiles(midi)
    const label = midi.length > 1 ? `${baseName(midi[0].fileName)} 외 ${midi.length - 1}개` : midi[0].fileName
    return [{ id: 'merged', label, info: m.info, warnings: m.warnings }, ...audioItems]
  }
  return [...midi.map((f) => ({ id: f.id, label: f.fileName, info: f, warnings: [] as string[] })), ...audioItems]
}

function buildState(item: OutputItem, override: SettingsOverride): ScoreState {
  try {
    const result = buildScore(item.info, applySettings(item.info, override))
    if (item.warnings.length) result.report.warnings = [...item.warnings, ...result.report.warnings]
    return { status: 'ok', result }
  } catch (e) {
    return { status: 'error', message: reportError(e) }
  }
}

export default function App() {
  const unsupported = useMemo(() => checkBrowserSupport(), [])
  const [files, setFiles] = useState<MidiFileInfo[]>([])
  const [failed, setFailed] = useState<FailedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [unit, setUnit] = useState<OutputUnit>('merged')
  const [overrides, setOverrides] = useState<Record<string, SettingsOverride>>({})
  const [results, setResults] = useState<Record<string, ScoreState>>({})
  const [selectedId, setSelectedId] = useState('')
  const [phone, setPhone] = useState(() => isPhoneOrTablet(readDeviceEnv()))
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [headerVisible, setHeaderVisible] = useState(true)

  // 맨 위 큰 제목이 (고정 막대에 가려질 만큼) 스크롤되어 사라졌는지 지켜본다
  useEffect(() => {
    const el = headerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setHeaderVisible(e.isIntersecting), {
      rootMargin: '-60px 0px 0px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // 화면 크기가 바뀌면 폰·태블릿 판별을 다시 한다 (기획서 6.1장)
  useEffect(() => {
    const onResize = () => setPhone(isPhoneOrTablet(readDeviceEnv()))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const items = useMemo(() => deriveItems(files, unit), [files, unit])

  // 기획서 5장 6번: 다른 파일을 첨부하면 이전 결과를 지우고 다시 읽는다.
  async function handleFiles(picked: File[]) {
    setLoading(true)
    setFiles([])
    setFailed([])
    setResults({})
    setOverrides({})
    const audio = picked.filter((f) => kindOfFile(f.name) === 'audio')
    const others = picked.filter((f) => kindOfFile(f.name) !== 'audio')
    const problems: FailedFile[] = []
    try {
      const read = await Promise.all(others.map(readMidiFile))
      const infos = read.flatMap((r) => (r.ok ? [r.info] : []))
      setFiles(infos)
      if (infos.length) {
        // 첨부하면 바로 악보까지 만든다 (출력 단위·설정을 바꾸면 자동으로 다시 만들어진다)
        const list = deriveItems(infos, unit)
        const built: Record<string, ScoreState> = {}
        for (const item of list) built[item.id] = buildState(item, {})
        setResults(built)
        setSelectedId(list[0]?.id ?? '')
      }
      problems.push(...read.flatMap((r) => (r.ok ? [] : [{ fileName: r.fileName, error: r.error }])))
      setFailed([...problems])

      // 음원은 PC에서만 분석한다. 폰·태블릿에서는 안내만 한다 (기획서 6.1장)
      if (phone) {
        problems.push(...audio.map((f) => ({ fileName: f.name.normalize('NFC'), error: t.errors.phoneAudio })))
        setFailed([...problems])
      } else {
        for (const file of audio) {
          const ctrl = new AbortController()
          abortRef.current = ctrl
          setAnalysis({ fileName: file.name.normalize('NFC'), stage: 'decode' })
          try {
            const info = await analyzeAudioFile(
              file,
              (stage, percent) => setAnalysis({ fileName: file.name.normalize('NFC'), stage, percent }),
              ctrl.signal,
            )
            setFiles((prev) => [...prev, info])
            // 분석이 끝나면 바로 주 멜로디 악보를 만들어 하단에 보여 준다 (기획서 5장 7번)
            const item: OutputItem = { id: info.id, label: info.fileName, info, warnings: [] }
            setResults((prev) => ({ ...prev, [info.id]: buildState(item, {}) }))
            setSelectedId(info.id)
          } catch (e) {
            if (e instanceof AnalysisCancelled) {
              problems.push({ fileName: file.name.normalize('NFC'), error: t.audio.cancelled })
              setFailed([...problems])
              break
            }
            problems.push({ fileName: file.name.normalize('NFC'), error: reportError(e) })
            setFailed([...problems])
          }
        }
        setAnalysis(null)
        abortRef.current = null
      }
    } catch (e) {
      setFailed([{ fileName: '', error: reportError(e) }])
    } finally {
      setLoading(false)
    }
  }

  function clearAll() {
    setFiles([])
    setFailed([])
    setResults({})
    setOverrides({})
  }

  /** 이미 만든 악보가 있는 항목만 새 설정으로 다시 만든다 ("값을 바꾸면 악보가 다시 만들어진다") */
  function rebuild(list: OutputItem[], ov: Record<string, SettingsOverride>, only: string[]) {
    setResults((prev) => {
      const next = { ...prev }
      for (const item of list) if (only.includes(item.id)) next[item.id] = buildState(item, ov[item.id] ?? {})
      return next
    })
  }

  function changeUnit(next: OutputUnit) {
    setUnit(next)
    const nextItems = deriveItems(files, next)
    const built: Record<string, ScoreState> = {} // 악보를 만드는 단위가 바뀌므로 이전 결과는 버리고 새 단위로 다시 만든다
    for (const item of nextItems) built[item.id] = buildState(item, overrides[item.id] ?? {})
    setResults(built)
    setSelectedId(nextItems[0]?.id ?? '')
  }

  function changeSettings(item: OutputItem, patch: SettingsOverride | null) {
    const merged = patch === null ? {} : { ...overrides[item.id], ...patch }
    const nextOverrides = { ...overrides, [item.id]: merged }
    setOverrides(nextOverrides)
    rebuild(items, nextOverrides, [item.id]) // 값을 바꾸면 악보가 바로 다시 만들어진다
  }

  const panelItems: PanelItem[] = items.flatMap((item) => {
    const r = results[item.id]
    if (!r || r.status !== 'ok') return []
    const settings = applySettings(item.info, overrides[item.id])
    return [
      {
        id: item.id,
        label: item.label,
        base: safeFileName(settings.title),
        info: item.info,
        settings,
        result: r.result,
        // 음원 분석 결과에는 방식에 맞는 안내를 미리보기 위에도 보여 준다 (기획서 8.5장 8번)
        note:
          item.info.source === 'audio'
            ? [settings.audioMode === 'melody' ? t.audio.warning : t.audio.warningFull, t.audio.warningMore]
            : undefined,
      },
    ]
  })
  // 첨부하면 악보가 바로 만들어지므로: 파일이 없으면 1, 악보가 나왔으면 3(확인하고 저장), 읽기만 되고 악보를 못 만들었으면 2(다듬기)
  const step = panelItems.length > 0 ? 3 : files.length > 0 ? 2 : 1

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header ref={headerRef}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            {t.appName}{' '}
            <span className="text-[27px] font-normal text-slate-400" data-testid="app-version">
              ({APP_VERSION})
            </span>
          </h1>
          <ThemeToggle />
        </div>
        <p className="mt-1 text-sm text-slate-300" data-testid="tagline">
          {phone ? t.taglineMidiOnly : t.tagline}
        </p>
        {!phone && (
          <p className="mt-1 text-xs text-slate-400" data-testid="tagline-note">
            {t.taglineNote}
          </p>
        )}
      </header>

      {!unsupported && <StepBar current={step} showTitle={!headerVisible} />}

      <Notices />

      {unsupported ? (
        <p
          className="rounded-xl border border-rose-900 bg-rose-950/60 p-4 text-rose-200"
          role="alert"
          data-testid="unsupported"
        >
          {unsupported}
        </p>
      ) : (
        <>
          <UsageGuide current={step} />
          {/* MIDI 첨부와 음원 분석 카드를 PC에서는 좌우로, 폰·태블릿에서는 위아래로 배치한다 */}
          <div className={phone ? 'flex flex-col gap-4' : 'grid gap-4 md:grid-cols-2'} data-testid="upload-cards">
            <UploadZone disabled={loading} phone={phone} onFiles={handleFiles} />
            <AudioUpload phone={phone} disabled={loading} onFiles={handleFiles} />
          </div>
          <AudioNotes phone={phone} />
          {analysis && <AnalysisProgress state={analysis} onCancel={() => abortRef.current?.abort()} />}
          {loading && <p className="text-sm text-slate-300">{t.upload.reading}</p>}

          {failed.length > 0 && (
            <section className="rounded-xl border border-rose-900 bg-rose-950/60 p-4" role="alert" data-testid="errors">
              <h2 className="text-sm font-semibold text-rose-200">{t.files.failedHeading}</h2>
              <ul className="mt-2 space-y-1 text-sm text-rose-200">
                {failed.map((f, i) => (
                  <li key={i}>
                    {f.fileName && <span className="font-medium break-all">{f.fileName} — </span>}
                    {f.error}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {files.length > 0 && (
            <>
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">{t.files.heading(files.length)}</h2>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex min-h-9 items-center px-1 text-sm text-slate-400 underline hover:text-slate-100"
                  >
                    {t.files.clearAll}
                  </button>
                </div>
                {files.map((f) => (
                  <TrackList key={f.id} info={f} />
                ))}
              </section>

              {/* 출력 단위·변환 방식은 MIDI에만 적용한다. 음원 분석 결과는 항상 주 멜로디 한 단이다. */}
              {files.some((f) => f.source !== 'audio') ? (
                <OptionsPanel unit={unit} hasAudio={files.some((f) => f.source === 'audio')} onUnit={changeUnit} />
              ) : (
                <p className="text-xs text-slate-400" data-testid="audio-separate-note">
                  {t.audio.separateNote}
                </p>
              )}

              {items.map((item) => (
                <OutputCard
                  key={item.id}
                  item={item}
                  override={overrides[item.id] ?? {}}
                  state={results[item.id]}
                  onChange={(patch) => changeSettings(item, patch)}
                />
              ))}
            </>
          )}

          {panelItems.length > 0 && (
            <ScorePanel
              items={panelItems}
              selectedId={selectedId}
              onSelect={setSelectedId}
              showZip={unit === 'separate'}
            />
          )}
        </>
      )}

      <ChangeLog />

      <footer
        className="mt-auto border-t border-slate-800 pt-4 pb-2 text-center text-xs text-slate-500"
        data-testid="footer"
      >
        {t.footer.copyright} · {t.footer.license} · {t.footer.credit}
      </footer>
    </div>
  )
}
