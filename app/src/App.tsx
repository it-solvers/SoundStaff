import { useMemo, useState } from 'react'
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
import type { ConvertMode, OutputUnit } from './score/types'
import { t } from './text/ko'
import { checkBrowserSupport, reportError } from './utils/errors'
import { baseName, safeFileName } from './utils/fileName'
import { APP_VERSION } from './version'

interface FailedFile {
  fileName: string
  error: string
}

/** 출력 단위에 따라 악보를 만들 단위를 정한다: 합쳐서 하나 / 파일마다 하나 */
function deriveItems(files: MidiFileInfo[], unit: OutputUnit): OutputItem[] {
  if (!files.length) return []
  if (unit === 'merged') {
    const m = mergeFiles(files)
    const label = files.length > 1 ? `${baseName(files[0].fileName)} 외 ${files.length - 1}개` : files[0].fileName
    return [{ id: 'merged', label, info: m.info, warnings: m.warnings }]
  }
  return files.map((f) => ({ id: f.id, label: f.fileName, info: f, warnings: [] }))
}

function buildState(item: OutputItem, override: SettingsOverride, mode: ConvertMode): ScoreState {
  try {
    const result = buildScore(item.info, applySettings(item.info, override), mode)
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
  const [mode, setMode] = useState<ConvertMode>('piano')
  const [touched, setTouched] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, SettingsOverride>>({})
  const [results, setResults] = useState<Record<string, ScoreState>>({})
  const [selectedId, setSelectedId] = useState('')

  const items = useMemo(() => deriveItems(files, unit), [files, unit])

  // 기획서 5장 6번: 다른 파일을 첨부하면 이전 결과를 지우고 다시 읽는다.
  async function handleFiles(picked: File[]) {
    setLoading(true)
    setFiles([])
    setFailed([])
    setResults({})
    setOverrides({})
    setTouched(false)
    try {
      const read = await Promise.all(picked.map(readMidiFile))
      setFiles(read.flatMap((r) => (r.ok ? [r.info] : [])))
      setFailed(read.flatMap((r) => (r.ok ? [] : [{ fileName: r.fileName, error: r.error }])))
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
    setTouched(false)
  }

  /** 이미 만든 악보가 있는 항목만 새 설정으로 다시 만든다 ("값을 바꾸면 악보가 다시 만들어진다") */
  function rebuild(list: OutputItem[], ov: Record<string, SettingsOverride>, m: ConvertMode, only: string[]) {
    setResults((prev) => {
      const next = { ...prev }
      for (const item of list) if (only.includes(item.id)) next[item.id] = buildState(item, ov[item.id] ?? {}, m)
      return next
    })
  }

  function build(item: OutputItem) {
    setResults((prev) => ({ ...prev, [item.id]: buildState(item, overrides[item.id] ?? {}, mode) }))
    setSelectedId(item.id)
  }

  function changeMode(next: ConvertMode) {
    setMode(next)
    setTouched(true)
    rebuild(items, overrides, next, Object.keys(results))
  }

  function changeUnit(next: OutputUnit) {
    setUnit(next)
    setTouched(true)
    const had = Object.keys(results).length > 0
    const nextItems = deriveItems(files, next)
    setResults({}) // 악보를 만드는 단위가 바뀌므로 이전 결과는 지운다
    if (had) {
      const built: Record<string, ScoreState> = {}
      for (const item of nextItems) built[item.id] = buildState(item, overrides[item.id] ?? {}, mode)
      setResults(built)
      setSelectedId(nextItems[0]?.id ?? '')
    }
  }

  function changeSettings(item: OutputItem, patch: SettingsOverride | null) {
    const merged = patch === null ? {} : { ...overrides[item.id], ...patch }
    const nextOverrides = { ...overrides, [item.id]: merged }
    setOverrides(nextOverrides)
    setTouched(true)
    if (results[item.id]) rebuild(items, nextOverrides, mode, [item.id])
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
      },
    ]
  })
  const step = panelItems.length > 0 ? 4 : files.length > 0 ? (touched ? 3 : 2) : 1

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.appName}{' '}
          <span className="text-lg font-normal text-slate-400" data-testid="app-version">
            ({APP_VERSION})
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-300" data-testid="tagline">
          {t.tagline}
        </p>
      </header>

      {!unsupported && <StepBar current={step} />}

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
          <UploadZone disabled={loading} onFiles={handleFiles} />
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
                    className="text-sm text-slate-400 underline hover:text-slate-100"
                  >
                    {t.files.clearAll}
                  </button>
                </div>
                {files.map((f) => (
                  <TrackList key={f.id} info={f} />
                ))}
              </section>

              <OptionsPanel unit={unit} mode={mode} onUnit={changeUnit} onMode={changeMode} />

              {items.map((item) => (
                <OutputCard
                  key={item.id}
                  item={item}
                  override={overrides[item.id] ?? {}}
                  state={results[item.id]}
                  onChange={(patch) => changeSettings(item, patch)}
                  onBuild={() => build(item)}
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
        {t.footer.copyright} · {t.footer.license}
      </footer>
    </div>
  )
}
