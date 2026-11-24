/** 어느 Colab 링크를 눌러도 안내판이 "Colab에 다녀오는 중"임을 알 수 있게 하는 신호 (detail.win: 열린 창, 없으면 새 탭) */
export const COLAB_OPENED_EVENT = 'soundstaff:colab-opened'
export const COLAB_WINDOW_NAME = 'soundstaff-colab'

export interface ColabOpenedDetail {
  win: Window | null
}

/** 창을 놓을 위치와 크기: 화면 오른쪽에 크게 띄워서 이 앱이 왼쪽에 그대로 보이게 한다 */
export function popupFeatures(screenInfo: {
  availWidth: number
  availHeight: number
  availLeft?: number
  availTop?: number
}): string {
  const w = Math.max(480, Math.min(1100, Math.round(screenInfo.availWidth * 0.6)))
  const h = Math.max(480, Math.round(screenInfo.availHeight * 0.92))
  const left = Math.max(0, (screenInfo.availLeft ?? 0) + screenInfo.availWidth - w)
  const top = Math.max(0, (screenInfo.availTop ?? 0) + Math.round((screenInfo.availHeight - h) / 2))
  return `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
}

/**
 * Colab을 작은 창(팝업)으로 연다. 이미 열려 있으면 그 창을 앞으로 가져온다.
 * 열린 창이 이 앱을 조작하지 못하게 opener를 끊는다. 팝업이 막혔으면 null을 돌려주고, 호출한 쪽이 새 탭 열기로 넘어간다.
 */
export function openColabWindow(url: string): Window | null {
  const win = window.open(
    url,
    COLAB_WINDOW_NAME,
    popupFeatures(window.screen as Screen & { availLeft?: number; availTop?: number }),
  )
  if (!win) return null
  try {
    win.opener = null
  } catch {
    // 이미 끊겨 있으면 그대로 둔다
  }
  win.focus()
  return win
}
