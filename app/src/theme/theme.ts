import { useSyncExternalStore } from 'react'
import { isDaytime } from './sun'

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
}

const build = (mode: ThemeMode, now: Date): Snapshot => ({
  mode,
  resolved: resolveTheme(mode, now),
})

let snapshot: Snapshot = { mode: 'auto', resolved: 'dark' }
const listeners = new Set<() => void>()
let started = false

/** 브라우저 주소창·상태 표시줄 색 (모바일) */
const THEME_COLOR: Record<ResolvedTheme, string> = { dark: '#020617', light: '#f8fafc' }

function paint(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved])
}

function apply(next: Snapshot) {
  paint(next.resolved)
  if (next.mode !== snapshot.mode || next.resolved !== snapshot.resolved) {
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
  paint(snapshot.resolved)
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
