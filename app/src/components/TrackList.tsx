import type { ReactNode } from 'react'
import { formatBytes, formatDuration, formatPitch, summarize } from '../midi/format'
import type { MidiFileInfo, TrackInfo } from '../midi/types'

function FromFileBadge({ fromFile }: { fromFile: boolean }) {
  return fromFile ? null : (
    <span className="ml-1 rounded bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-200">파일에 없음</span>
  )
}

function kindLabel(t: TrackInfo) {
  if (t.kind === 'drum') return <span className="rounded bg-rose-900/50 px-1.5 py-0.5 text-xs text-rose-200">드럼 · 악보 제외</span>
  if (t.kind === 'empty') return <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">음표 없음</span>
  return <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-xs text-emerald-200">음높이 악기</span>
}

interface Props {
  info: MidiFileInfo
  onBuild: () => void
  children?: ReactNode
}

export default function TrackList({ info, onBuild, children }: Props) {
  const s = summarize(info)
  const drumCount = info.tracks.filter((t) => t.kind === 'drum').length

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" data-testid="file-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="break-all text-base font-semibold">{info.fileName}</h3>
        <p className="text-xs text-slate-400">
          {formatBytes(info.size)} · 길이 {formatDuration(info.durationSec)} · 해상도 {info.ppq} PPQ
        </p>
      </header>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-slate-800/60 px-3 py-2">
          <dt className="text-xs text-slate-400">템포</dt>
          <dd data-testid="tempo">
            {s.tempo.text}
            <FromFileBadge fromFile={s.tempo.fromFile} />
          </dd>
        </div>
        <div className="rounded-lg bg-slate-800/60 px-3 py-2">
          <dt className="text-xs text-slate-400">박자</dt>
          <dd data-testid="timesig">
            {s.timeSignature.text}
            <FromFileBadge fromFile={s.timeSignature.fromFile} />
          </dd>
        </div>
        <div className="rounded-lg bg-slate-800/60 px-3 py-2">
          <dt className="text-xs text-slate-400">조성</dt>
          <dd data-testid="key">
            {s.key.text}
            <FromFileBadge fromFile={s.key.fromFile} />
          </dd>
        </div>
      </dl>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs text-slate-400">
            <tr>
              <th className="py-1 pr-3 font-medium">#</th>
              <th className="py-1 pr-3 font-medium">트랙 이름</th>
              <th className="py-1 pr-3 font-medium">악기</th>
              <th className="py-1 pr-3 font-medium">채널</th>
              <th className="py-1 pr-3 text-right font-medium">음표 수</th>
              <th className="py-1 pr-3 font-medium">음역</th>
              <th className="py-1 font-medium">구분</th>
            </tr>
          </thead>
          <tbody>
            {info.tracks.map((t) => (
              <tr key={t.index} className="border-t border-slate-800" data-testid="track-row">
                <td className="py-2 pr-3 text-slate-400">{t.index + 1}</td>
                <td className="py-2 pr-3">{t.name || <span className="text-slate-500">(이름 없음)</span>}</td>
                <td className="py-2 pr-3">{t.kind === 'drum' ? '드럼/타악기' : t.instrumentName}</td>
                <td className="py-2 pr-3">{t.channel}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.noteCount}</td>
                <td className="py-2 pr-3 tabular-nums">
                  {t.lowestMidi !== undefined && t.highestMidi !== undefined
                    ? `${formatPitch(t.lowestMidi)} ~ ${formatPitch(t.highestMidi)}`
                    : '-'}
                </td>
                <td className="py-2">{kindLabel(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drumCount > 0 && (
        <p className="mt-3 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-200" data-testid="drum-notice">
          드럼 트랙 {drumCount}개는 악보에서 제외됩니다. (드럼은 음높이가 없는 타악기 소리라 일반 악보로 옮기지 않습니다)
        </p>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={onBuild}
          className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-600"
          data-testid="build-score"
        >
          악보 만들기
        </button>
      </div>
      {children}
    </article>
  )
}
