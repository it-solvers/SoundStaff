/**
 * 변경 이력. 기능을 추가하거나 화면을 바꿀 때마다 맨 위에 새 항목을 쓰고 package.json의 version도 같은 값으로 올린다.
 * (두 값이 다르면 빌드가 실패한다 — vite.config.ts)
 *
 * 버전 규칙: 기능 추가 → 두 번째 자리(1.1.0), 화면 문구·배치 변경과 버그 수정 → 세 번째 자리(1.0.1), 큰 개편 → 첫 번째 자리(2.0.0)
 */
export interface ChangeEntry {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '1.0.0',
    date: '2026-11-24',
    changes: [
      'MIDI 파일 첨부(끌어다 놓기, 여러 파일)와 트랙·템포·박자·조성 표시, 드럼 트랙 제외 안내',
      '악기별 악보 만들기 (양자화, 마디, 화음·성부, 붙임줄, MusicXML 3.1)',
      '피아노로 합치기: 오른손·왼손 두 줄, 한 손으로 칠 수 있게 정리하고 제거된 음 수 표시',
      '악보 미리보기(확대·축소), PDF 다운로드(한글 지원, 여러 쪽), MusicXML 다운로드',
      '화면: 다크 모드, 사용 방법 안내, 안내 문구 3종, 버전·변경 이력 표시',
    ],
  },
]
