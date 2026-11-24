import { useSyncExternalStore } from 'react'
import { isDaytime, nearestSunTimes, type SunTimes } from './sun'

export type ThemeMode = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const KEY = 'soundstaff-theme'
const MODES: ThemeMode[] = ['auto', 'light', 'dark']

/** 자동이면 해가 떠 있는 동안 밝게, 해가 지면 어둡게 */
export function resolveTheme(mode: ThemeMode, now: Date): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode
  return isDaytime(now) ? 'light' : 'dark'
}

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v && (MODES as string[]).includes(v)) return v as ThemeMode
  } catch {
    // 저장소를 쓸 수 없으면 자동
  }
  return 'auto'
}

interface Snapshot {
  mode: ThemeMode
  resolved: ResolvedTheme
  /** 자동 모드에서 보여 줄 일출·일몰 (그 밖에는 null) */
  sun: SunTimes | null
}

const build = (mode: ThemeMode, now: Date): Snapshot => ({
  mode,
  resolved: resolveTheme(mode, now),
  sun: mode === 'auto' ? nearestSunTimes(now) : null,
})

let snapshot: Snapshot = { mode: 'auto', resolved: 'dark', sun: null }
const listeners = new Set<() => void>()
let started = false

function apply(next: Snapshot) {
  document.documentElement.dataset.theme = next.resolved
  if (
    next.mode !== snapshot.mode ||
    next.resolved !== snapshot.resolved ||
    next.sun?.sunrise.getTime() !== snapshot.sun?.sunrise.getTime()
  ) {
    snapshot = next
    listeners.forEach((l) => l())
  }
}

function refresh() {
  apply(build(snapshot.mode, new Date()))
}

/** 첫 그리기 전에 불러서 어두운 화면이 번쩍이지 않게 한다. 자동 모드에서는 일출·일몰을 넘길 때 바뀌도록 주기적으로 확인한다. */
export function initTheme() {
  if (started) return
  started = true
  const mode = readMode()
  snapshot = build(mode, new Date())
  document.documentElement.dataset.theme = snapshot.resolved
  setInterval(refresh, 30_000)
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // 저장하지 못해도 이번 화면에서는 적용된다
  }
  apply(build(mode, new Date()))
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getSnapshot = () => snapshot

export function useTheme(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot)
}
