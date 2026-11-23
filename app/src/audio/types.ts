/** 모든 자동 추정값은 이 타입으로 감싸서 화면에 "추정"으로 표시한다. */
export interface Estimate<T> {
  value: T
  /** 0~1, 추정에 대한 상대적 확신도 (확률이 아님) */
  confidence: number
}
