/**
 * 고품질 변환(Google Colab) 노트북 공유 주소 (기획서 4.1장 10번, 13장 18번).
 * 작성자가 노트북을 배포한 뒤 이 값(따옴표 안)에 주소를 넣으면 (시험용으로는 환경변수 VITE_COLAB_URL로도 줄 수 있다) 버튼이 켜진다. 비어 있으면 "준비 중"으로 표시한다.
 * 사용자가 직접 클릭해 새 탭으로 여는 일반 링크이며, 파일은 어디로도 전송되지 않는다.
 */
export const COLAB_URL: string = import.meta.env.VITE_COLAB_URL || ''
