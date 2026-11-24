/**
 * 고품질 변환(Google Colab) 노트북 공유 주소 (기획서 4.1장 10번).
 * 노트북 파일은 저장소의 `colab/soundstaff_hq_convert.ipynb`이며, 아래 주소는 GitHub에 올라간(푸시된) 그 파일을
 * Colab에서 바로 여는 주소다. 푸시하기 전에는 열리지 않는다.
 * 시험용으로는 환경변수 VITE_COLAB_URL로 다른 주소를 줄 수 있다. 값이 비어 있으면 버튼은 "준비 중"으로 표시한다.
 * 사용자가 직접 클릭해 새 탭으로 여는 일반 링크이며, 파일은 어디로도 전송되지 않는다.
 */
export const COLAB_NOTEBOOK_PATH = 'colab/soundstaff_hq_convert.ipynb'
export const COLAB_URL: string =
  import.meta.env.VITE_COLAB_URL ||
  'https://colab.research.google.com/github/it-solvers/SoundStaff/blob/main/' + COLAB_NOTEBOOK_PATH
