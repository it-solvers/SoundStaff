/**
 * 편집용(Finale에서 고치기 쉽게) 정리의 조정값.
 * 정답 악보(시험곡 원본 PDF)와 비교해 맞춘 값이 기본값이다. 화면에서는 바꿀 수 없고, 시험·조정용으로만 설정(ScoreSettings.editTuning)으로 덮어쓴다.
 * 짧은 화음 변화 합치기(smoothSteps·smoothSimilarity)는 고칠 곳을 줄이는 대신 정확도를 조금 내준다: 유사도 0.75는 화음 59 → 56개로 정확도가 같고, 0.6은 화음 59 → 48개·붙임줄 조각 139 → 97개에 음이름 F1 0.947 → 0.942, 0.5부터는 0.926 이하로 떨어져 0.6을 택했다.
 * 맞춘 근거 (7개 보표 정답 대비 음이름 F1, 박 지도 없이): 이어 붙이는 틈 0.25초 → 0.4초는 +0.01, 뒷받침 음 35% → 50%는 화음 구간 수를 46 → 37개로 줄이면서 점수는 그대로,
 * 한 손 음 4 → 5개는 옥타브까지 본 F1이 +0.04, 배음 비율 0.5는 어떤 지표도 나빠지지 않는 가장 큰 값이다(0.7은 옥타브 오류가 7 → 3개로 줄지만 실제 악보의 옥타브 겹침까지 빠져 재현율이 떨어진다). 조정값마다 효과가 작고(전체 점수의 1~2%) 평평한 구간이라서, 이 곡에만 맞춘 극단값은 쓰지 않았다.
 */
export interface EditTuning {
  /** 같은 높이의 음을 이어 붙이는 틈 (초) */
  mergeGapSec: number
  /** "뒤에 깔리는 음"으로 보고 뺄 비율 (소리가 작고 짧은 쪽, 0~1) */
  dropShare: number
  /** 칸에 맞춘 뒤 같은 높이·같은 화음을 이어 붙이는 틈 (16분음표 칸 수) */
  joinSteps: number
  /** 한 손(한 보표)에 동시에 적는 음의 최대 개수 */
  maxNotes: number
  /** 한 옥타브 아래에 같은 시간 울리는 더 센 음이 있고 이 음의 세기가 그 음의 (이 값)배보다 작으면 배음으로 보고 뺀다. 0이면 끄기 */
  harmonicRatio: number
  /** 이 칸 수(16분음표) 이하로 짧은 화음 변화는, 앞 화음과 비슷하고(아래 smoothSimilarity) 가장 낮은 음이 같으면 앞 화음에 합친다. 0이면 끄기 */
  smoothSteps: number
  /** 앞 화음과 비슷하다고 보는 정도: 공통 음 수 ÷ 전체 음 수 (0~1) */
  smoothSimilarity: number
  /** 음의 끝을 앞으로 당기는 양 (16분음표 칸 수). 음원 분석은 울림 때문에 음의 끝을 늦게 잡아서, 새 화음이 시작할 때 이전 화음이 남는 것을 줄인다 */
  endBias: number
}

export const DEFAULT_EDIT_TUNING: EditTuning = {
  mergeGapSec: 0.4,
  dropShare: 0.5,
  joinSteps: 2,
  maxNotes: 5,
  harmonicRatio: 0.5,
  smoothSteps: 4,
  smoothSimilarity: 0.6,
  endBias: 0,
}

export const resolveEditTuning = (t?: Partial<EditTuning>): EditTuning => ({ ...DEFAULT_EDIT_TUNING, ...t })
