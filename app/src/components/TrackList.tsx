import { formatBytes, formatDuration, formatPitch, summarize } from '../midi/format'
import type { MidiFileInfo, TrackInfo } from '../midi/types'
import { t } from '../text/ko'

function FromFileBadge({ fromFile, audio }: { fromFile: boolean; audio: boolean }) {
  // 음원 분석 결과의 템포·박자·조성은 모두 추정값이다
  if (audio)
    return <span className="ml-1 rounded bg-sky-900/60 px-1.5 py-0.5 text-xs text-sky-200">{t.audio.estimated}</span>
  return fromFile ? null : (
    <span className="ml-1 rounded bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-200">{t.files.notInFile}</span>
  )
}

function kindLabel(tr: TrackInfo) {
  if (tr.kind === 'drum')
    return <span className="rounded bg-rose-900/50 px-1.5 py-0.5 text-xs text-rose-200">{t.files.kind.drum}</span>
  if (tr.kind === 'empty')
    return <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">{t.files.kind.empty}</span>
  return (
    <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-xs text-emerald-200">{t.files.kind.pitched}</span>
  )
}

/** 파일 하나에서 읽은 정보: 템포·박자·조성, 트랙 목록 */
export default function TrackList({ info }: { info: MidiFileInfo }) {
  const s = summarize(info)
  const isAudio = info.source === 'audio' && !!info.audio
  const drumCount = info.tracks.filter((tr) => tr.kind === 'drum').length
  const c = t.files.columns

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" data-testid="file-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="break-all text-base font-semibold">{info.fileName}</h3>
        <p className="text-xs text-slate-400">
          {isAudio
            ? t.files.metaAudio(formatBytes(info.size), formatDuration(info.durationSec))
            : t.files.meta(formatBytes(info.size), formatDuration(info.durationSec), info.ppq)}
        </p>
      </header>

      {isAudio && info.audio && (
        <div
          className="mt-3 space-y-1 rounded-lg bg-amber-900/40 px-3 py-2 text-sm text-amber-200"
          data-testid="audio-banner"
        >
          <p className="font-medium">{t.audio.warningGeneric}</p>
          <p data-testid="audio-summary">
            {t.audio.summary(
              info.audio.detectedCount,
              info.audio.allNotes.length,
              info.audio.notes.length,
              info.audio.backend,
              Math.round(info.audio.elapsedMs / 1000),
            )}
          </p>
          <p data-testid="audio-vocal-hint">{t.audio.vocalHint}</p>
          <p>{t.audio.guessed}</p>
        </div>
      )}

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-slate-800/60 px-3 py-2">
          <dt className="text-xs text-slate-400">{t.files.tempo}</dt>
          <dd data-testid="tempo">
            {s.tempo.text}
            <FromFileBadge fromFile={s.tempo.fromFile} audio={isAudio} />
          </dd>
        </div>
        <div className="rounded-lg bg-slate-800/60 px-3 py-2">
          <dt className="text-xs text-slate-400">{t.files.timeSignature}</dt>
          <dd data-testid="timesig">
            {s.timeSignature.text}
            <FromFileBadge fromFile={s.timeSignature.fromFile} audio={isAudio} />
          </dd>
        </div>
        <div className="rounded-lg bg-slate-800/60 px-3 py-2">
          <dt className="text-xs text-slate-400">{t.files.key}</dt>
          <dd data-testid="key">
            {s.key.text}
            <FromFileBadge fromFile={s.key.fromFile} audio={isAudio} />
          </dd>
        </div>
      </dl>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs text-slate-400">
            <tr>
              <th className="py-1 pr-3 font-medium">#</th>
              <th className="py-1 pr-3 font-medium">{c.track}</th>
              <th className="py-1 pr-3 font-medium">{c.instrument}</th>
              <th className="py-1 pr-3 font-medium">{c.channel}</th>
              <th className="py-1 pr-3 text-right font-medium">{c.notes}</th>
              <th className="py-1 pr-3 font-medium">{c.range}</th>
              <th className="py-1 font-medium">{c.kind}</th>
            </tr>
          </thead>
          <tbody>
            {info.tracks.map((tr) => (
              <tr key={tr.index} className="border-t border-slate-800" data-testid="track-row">
                <td className="py-2 pr-3 text-slate-400">{tr.index + 1}</td>
                <td className="py-2 pr-3">{tr.name || <span className="text-slate-500">{t.files.unnamed}</span>}</td>
                <td className="py-2 pr-3">{tr.kind === 'drum' ? t.files.drumInstrument : tr.instrumentName}</td>
                <td className="py-2 pr-3">{tr.channel}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{tr.noteCount}</td>
                <td className="py-2 pr-3 tabular-nums">
                  {tr.lowestMidi !== undefined && tr.highestMidi !== undefined
                    ? `${formatPitch(tr.lowestMidi)} ~ ${formatPitch(tr.highestMidi)}`
                    : '-'}
                </td>
                <td className="py-2">{kindLabel(tr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drumCount > 0 && (
        <p className="mt-3 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-200" data-testid="drum-notice">
          {t.files.drumNotice(drumCount)}
        </p>
      )}
    </article>
  )
}
