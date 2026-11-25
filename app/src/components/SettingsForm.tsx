import { useState } from 'react'
import { prettyTonic, tonicName } from '../midi/keys'
import type { MidiFileInfo } from '../midi/types'
import {
  BEAT_TYPES,
  KEY_OPTIONS,
  TEMPO_MAX,
  TEMPO_MIN,
  fileValues,
  isValidBeats,
  isValidTempo,
  tempoAlternatives,
  keyValue,
  type SettingsOverride,
} from '../score/settings'
import { t } from '../text'

interface Props {
  info: MidiFileInfo
  override: SettingsOverride
  /** patch의 값이 undefined이면 MIDI 파일 값으로 되돌린다. null이면 모두 되돌린다. */
  onChange: (patch: SettingsOverride | null) => void
}

const field = 'rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100'
const label = 'block text-xs text-slate-400'

/** 제목·작곡자·박자·템포·조성 입력 칸. 기본값은 MIDI 파일에서 읽은 값이고, 바꾸면 그 값으로 악보를 다시 만든다. */
export default function SettingsForm({ info, override, onChange }: Props) {
  const f = fileValues(info)
  // 음원 분석 결과는 MIDI 값이 아니라 "추정값"이 기본이다
  const hint = info.source === 'audio' ? t.settings.estimatedValue : t.settings.fromFile
  const [tempoText, setTempoText] = useState(override.tempo?.toString() ?? '')
  const [beatsText, setBeatsText] = useState(override.beats?.toString() ?? '')
  const tempoBad = tempoText.trim() !== '' && !isValidTempo(Number(tempoText))
  const beatsBad = beatsText.trim() !== '' && !isValidBeats(Number(beatsText))
  const keyNow = override.key ?? f.key
  // 음원 분석: 지금 템포(고친 값이 있으면 그 값)의 절반·두 배 후보
  const tempoNow = override.tempo ?? f.tempo
  const alt = tempoAlternatives(tempoNow)
  const setTempo = (v: number) => {
    setTempoText(String(v))
    onChange({ tempo: v })
  }
  const keyFileLabel = f.keyFromFile ? `${prettyTonic(tonicName(f.key.fifths, f.key.mode))}` : ''

  return (
    <div className="mt-4" data-testid="settings-form">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t.settings.heading}</h4>
        <button
          type="button"
          className="inline-flex min-h-9 items-center px-1 text-xs text-slate-400 underline hover:text-slate-100"
          data-testid="reset-settings"
          onClick={() => {
            setTempoText('')
            setBeatsText('')
            onChange(null)
          }}
        >
          {info.source === 'audio' ? t.settings.resetEstimated : t.settings.reset}
        </button>
      </div>

      {info.source === 'audio' && (
        <fieldset className="mt-3" data-testid="audio-mode">
          <legend className="text-xs text-slate-400">{t.audio.mode.legend}</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {(['full', 'melody'] as const).map((m) => {
              const on = (override.audioMode ?? 'full') === m
              return (
                <label
                  key={m}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
                    on ? 'border-sky-500 bg-sky-950' : 'border-slate-700 bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="audio-mode"
                    className="mt-1"
                    checked={on}
                    onChange={() =>
                      // 방식을 바꾸면 악보의 단이 달라지므로 악기 설정(순서·소리 끄기·빼기)은 처음으로 돌린다
                      onChange({
                        audioMode: m,
                        trackOrder: undefined,
                        excludedTracks: undefined,
                        mutedTracks: undefined,
                      })
                    }
                    data-testid={`audio-mode-${m}`}
                  />
                  <span>
                    <span className="block font-medium">{t.audio.mode[m].label}</span>
                    <span className="mt-0.5 block text-xs text-slate-300">{t.audio.mode[m].desc}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {(override.audioMode ?? 'full') === 'full' && (override.audioSimplify ?? true) && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm" data-testid="audio-edit-label">
              <input
                type="checkbox"
                className="mt-1"
                checked={override.audioEdit ?? true}
                onChange={(e) => onChange({ audioEdit: e.target.checked ? undefined : false })}
                data-testid="audio-edit"
              />
              <span>
                <span className="font-medium">{t.audio.edit.label}</span>
                <span className="ml-1 text-xs text-slate-300">{t.audio.edit.desc}</span>
              </span>
            </label>
          )}
          {(override.audioMode ?? 'full') === 'full' &&
            !((override.audioEdit ?? true) && (override.audioSimplify ?? true)) && (
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm" data-testid="audio-emphasis-label">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={override.audioEmphasis ?? true}
                  onChange={(e) => onChange({ audioEmphasis: e.target.checked ? undefined : false })}
                  data-testid="audio-emphasis"
                />
                <span>
                  <span className="font-medium">{t.audio.emphasis.label}</span>
                  <span className="ml-1 text-xs text-slate-300">{t.audio.emphasis.desc}</span>
                </span>
              </label>
            )}
          {(override.audioMode ?? 'full') === 'full' && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm" data-testid="audio-merge-label">
              <input
                type="checkbox"
                className="mt-1"
                checked={override.audioMerge ?? true}
                onChange={(e) => onChange({ audioMerge: e.target.checked ? undefined : false })}
                data-testid="audio-merge"
              />
              <span>
                <span className="font-medium">{t.audio.merge.label}</span>
                <span className="ml-1 text-xs text-slate-300">{t.audio.merge.desc}</span>
              </span>
            </label>
          )}
          {(override.audioMode ?? 'full') === 'full' && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm" data-testid="audio-simplify-label">
              <input
                type="checkbox"
                className="mt-1"
                checked={override.audioSimplify ?? true}
                onChange={(e) => onChange({ audioSimplify: e.target.checked ? undefined : false })}
                data-testid="audio-simplify"
              />
              <span>
                <span className="font-medium">{t.audio.simplify.label}</span>
                <span className="ml-1 text-xs text-slate-300">{t.audio.simplify.desc}</span>
              </span>
            </label>
          )}
        </fieldset>
      )}

      {info.source !== 'audio' && (
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm" data-testid="midi-tidy-label">
          <input
            type="checkbox"
            className="mt-1"
            checked={override.midiTidy ?? true}
            onChange={(e) => onChange({ midiTidy: e.target.checked ? undefined : false })}
            data-testid="midi-tidy"
          />
          <span>
            <span className="font-medium">{t.settings.tidy.label}</span>
            <span className="ml-1 text-xs text-slate-300">{t.settings.tidy.desc}</span>
          </span>
        </label>
      )}

      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className={label}>{t.settings.title}</span>
          <input
            type="text"
            className={`${field} w-full`}
            value={override.title ?? ''}
            placeholder={f.title}
            data-testid="input-title"
            onChange={(e) => onChange({ title: e.target.value === '' ? undefined : e.target.value })}
          />
        </label>
        <label className="block">
          <span className={label}>{t.settings.composer}</span>
          <input
            type="text"
            className={`${field} w-full`}
            value={override.composer ?? ''}
            data-testid="input-composer"
            onChange={(e) => onChange({ composer: e.target.value === '' ? undefined : e.target.value })}
          />
        </label>
        <label className="block">
          <span className={label}>{t.settings.tempo}</span>
          <input
            type="number"
            min={TEMPO_MIN}
            max={TEMPO_MAX}
            step="any"
            inputMode="decimal"
            className={`${field} w-full ${tempoBad ? 'border-rose-500' : ''}`}
            value={tempoText}
            placeholder={String(f.tempo)}
            data-testid="input-tempo"
            onChange={(e) => {
              const v = e.target.value
              setTempoText(v)
              if (v.trim() === '') onChange({ tempo: undefined })
              else if (isValidTempo(Number(v))) onChange({ tempo: Number(v) })
            }}
          />
          <span className="mt-1 block text-xs text-slate-500">{hint(`${f.tempo} BPM`)}</span>
          {tempoBad && (
            <span className="mt-1 block text-xs text-rose-300" data-testid="tempo-error">
              {t.settings.invalidTempo}
            </span>
          )}
          {info.source === 'audio' && !tempoBad && (
            <span className="mt-2 block" data-testid="tempo-octave">
              <span className="block text-xs text-slate-400">{t.settings.tempoOctaveHint}</span>
              <span className="mt-1 flex flex-wrap gap-2">
                {alt.half !== null && (
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs text-slate-100 hover:bg-slate-700"
                    data-testid="tempo-half"
                    onClick={() => setTempo(alt.half!)}
                  >
                    {t.settings.tempoHalf(alt.half)}
                  </button>
                )}
                {alt.double !== null && (
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs text-slate-100 hover:bg-slate-700"
                    data-testid="tempo-double"
                    onClick={() => setTempo(alt.double!)}
                  >
                    {t.settings.tempoDouble(alt.double)}
                  </button>
                )}
              </span>
            </span>
          )}
        </label>
        <div>
          <span className={label}>{t.settings.timeSignature}</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={32}
              step={1}
              inputMode="numeric"
              aria-label={t.settings.beatsTop}
              className={`${field} w-20 ${beatsBad ? 'border-rose-500' : ''}`}
              value={beatsText}
              placeholder={String(f.beats)}
              data-testid="input-beats"
              onChange={(e) => {
                const v = e.target.value
                setBeatsText(v)
                if (v.trim() === '') onChange({ beats: undefined })
                else if (isValidBeats(Number(v))) onChange({ beats: Number(v) })
              }}
            />
            <span aria-hidden="true">/</span>
            <select
              aria-label={t.settings.beatsBottom}
              className={`${field} w-20`}
              value={override.beatType ?? f.beatType}
              data-testid="input-beattype"
              onChange={(e) => onChange({ beatType: Number(e.target.value) })}
            >
              {[...new Set([...BEAT_TYPES, f.beatType])]
                .sort((a, b) => a - b)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </div>
          <span className="mt-1 block text-xs text-slate-500">{hint(`${f.beats}/${f.beatType}`)}</span>
          {beatsBad && (
            <span className="mt-1 block text-xs text-rose-300" data-testid="beats-error">
              {t.settings.invalidBeats}
            </span>
          )}
        </div>
        <label className="block">
          <span className={label}>{t.settings.key}</span>
          <select
            className={`${field} w-full`}
            value={keyValue(keyNow)}
            data-testid="input-key"
            onChange={(e) => {
              const o = KEY_OPTIONS.find((k) => k.value === e.target.value)!
              onChange({ key: { fifths: o.fifths, mode: o.mode } })
            }}
          >
            <optgroup label={t.settings.keyMajor}>
              {KEY_OPTIONS.filter((k) => k.mode === 'major').map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={t.settings.keyMinor}>
              {KEY_OPTIONS.filter((k) => k.mode === 'minor').map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </optgroup>
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            {hint(
              f.keyFromFile
                ? `${keyFileLabel} ${f.key.mode === 'minor' ? t.settings.keyMinor : t.settings.keyMajor}`
                : t.files.noKey,
            )}
          </span>
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">{t.settings.changedHint}</p>
    </div>
  )
}
