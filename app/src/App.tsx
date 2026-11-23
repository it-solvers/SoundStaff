import { useState } from 'react'
import ScorePanel from './components/ScorePanel'
import ScoreResult, { type ScoreState } from './components/ScoreResult'
import TrackList from './components/TrackList'
import UploadZone from './components/UploadZone'
import { readMidiFile } from './midi/readMidi'
import type { MidiFileInfo } from './midi/types'
import { buildInstrumentScore, defaultSettings } from './score/buildScore'

interface FailedFile {
  fileName: string
  error: string
}

export default function App() {
  const [files, setFiles] = useState<MidiFileInfo[]>([])
  const [failed, setFailed] = useState<FailedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [scores, setScores] = useState<Record<string, ScoreState>>({})
  const [selectedId, setSelectedId] = useState('')

  // 기획서 5장 6번: 다른 파일을 첨부하면 이전 결과를 지우고 다시 읽는다.
  async function handleFiles(picked: File[]) {
    setLoading(true)
    setFiles([])
    setFailed([])
    setScores({})
    const results = await Promise.all(picked.map(readMidiFile))
    setFiles(results.flatMap((r) => (r.ok ? [r.info] : [])))
    setFailed(results.flatMap((r) => (r.ok ? [] : [{ fileName: r.fileName, error: r.error }])))
    setLoading(false)
  }

  function clearAll() {
    setFiles([])
    setFailed([])
    setScores({})
  }

  function buildScore(info: MidiFileInfo) {
    try {
      const result = buildInstrumentScore(info, defaultSettings(info))
      setScores((s) => ({ ...s, [info.id]: { status: 'ok', result } }))
      setSelectedId(info.id)
    } catch (e) {
      setScores((s) => ({ ...s, [info.id]: { status: 'error', message: e instanceof Error ? e.message : String(e) } }))
    }
  }

  const panelItems = files.flatMap((f) => {
    const s = scores[f.id]
    return s && s.status === 'ok' ? [{ id: f.id, fileName: f.fileName, result: s.result }] : []
  })

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">음원 → 피아노 악보 변환</h1>
        <p className="mt-1 text-sm text-slate-300">
          음원의 MIDI(미디, 음 높이·길이를 숫자로 기록한 연주 정보 파일)를 악보로 바꿉니다.
        </p>
        <p
          role="note"
          className="mt-3 rounded-lg border border-sky-800 bg-sky-950 px-3 py-2 text-sm text-sky-100"
          data-testid="privacy-notice"
        >
          파일이 서버로 전송되지 않습니다. 모든 처리는 이 브라우저 안에서만 이루어집니다.
        </p>
      </header>

      <UploadZone disabled={loading} onFiles={handleFiles} />

      {loading && <p className="text-sm text-slate-300">MIDI 파일을 읽는 중…</p>}

      {failed.length > 0 && (
        <section className="rounded-xl border border-rose-900 bg-rose-950/60 p-4" role="alert" data-testid="errors">
          <h2 className="text-sm font-semibold text-rose-200">읽지 못한 파일</h2>
          <ul className="mt-2 space-y-1 text-sm text-rose-200">
            {failed.map((f, i) => (
              <li key={i}>
                <span className="font-medium break-all">{f.fileName}</span> — {f.error}
              </li>
            ))}
          </ul>
        </section>
      )}

      {files.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">읽은 정보 ({files.length}개 파일)</h2>
            <button type="button" onClick={clearAll} className="text-sm text-slate-400 underline hover:text-slate-100">
              모두 지우기
            </button>
          </div>
          {files.map((f) => (
            <TrackList key={f.id} info={f} onBuild={() => buildScore(f)}>
              {scores[f.id] && <ScoreResult state={scores[f.id]} />}
            </TrackList>
          ))}
        </section>
      )}

      {panelItems.length > 0 && <ScorePanel items={panelItems} selectedId={selectedId} onSelect={setSelectedId} />}
    </div>
  )
}
