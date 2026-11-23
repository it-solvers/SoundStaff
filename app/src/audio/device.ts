/**
 * 폰·태블릿 판별 (기획서 6.1장, 작성자 확인한 방식).
 * 아래 중 하나라도 해당하면 폰·태블릿으로 본다. 음원 분석 메뉴를 숨기고 AI 모델도 내려받지 않는다.
 *  1) 화면 너비 768px 미만
 *  2) 터치가 주 입력 장치(pointer: coarse)이면서 화면 너비 1024px 미만 (태블릿)
 *  3) 브라우저가 모바일이라고 알릴 때 (userAgentData.mobile)
 */
export interface DeviceEnv {
  width: number
  coarsePointer: boolean
  uaMobile: boolean
}

export function isPhoneOrTablet(env: DeviceEnv): boolean {
  return env.width < 768 || (env.coarsePointer && env.width < 1024) || env.uaMobile
}

export function readDeviceEnv(): DeviceEnv {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  return {
    width: window.innerWidth,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    uaMobile: nav.userAgentData?.mobile === true,
  }
}
