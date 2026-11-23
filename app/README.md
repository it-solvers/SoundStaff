# 음원 → 피아노 악보 변환 웹앱

음원의 MIDI 파일을 브라우저에서 악보로 변환하는 정적 웹앱. 서버·DB 없음, 파일은 외부로 전송되지 않는다.
기획서: `../PLAN.md`

## 진행 상황

| 단계 | 내용 | 상태 |
|---|---|---|
| M1 | 프로젝트 생성, 첨부 UI, MIDI 읽기, 트랙 목록 표시 | 완료 |
| M2 | 양자화·마디 구성·MusicXML 생성 (악기별 악보) | 완료 (Finale에서 열리는지 작성자 확인 대기) |
| M3 | 악보 표시(OSMD), PDF·MusicXML 다운로드 | 완료 |
| M4 | 피아노로 합치기 + 제거 음 표시 | 완료 (Finale에서 열리고 연주 가능한 수준인지 작성자 확인 대기) |
| M5 | 출력 단위 선택, 입력 칸, 피아노 MIDI, ZIP | 미구현 |
| M6 | 음원 분석 (무료 요금제 사용자용 핵심 기능, PC 전용) | 미구현 |
| M7 | 빌드 점검, 오류 처리, 폰 화면 점검 | 미구현 |

## 버전 관리

화면 제목 옆 `(1.0.0)`과 브라우저 탭 제목에 버전이 표시된다. 기능을 추가하거나 화면을 바꿀 때마다 올린다.

| 변경 | 올리는 자리 | 예 |
|---|---|---|
| 기능 추가 | 두 번째 | 1.0.0 → 1.1.0 |
| 화면 문구·배치 변경, 버그 수정 | 세 번째 | 1.1.0 → 1.1.1 |
| 큰 개편 | 첫 번째 | 1.x → 2.0.0 |

올리는 방법: `package.json`의 `version`과 `src/changelog.ts` 맨 위에 새 항목을 **같은 값으로** 함께 바꾼다. 두 값이 다르면 개발 서버·빌드가 멈추고 알려 준다.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # dist/ 정적 파일 생성 (타입 검사 포함)
npm run lint
```

## 사용 라이브러리 (라이선스)

| 라이브러리 | 버전 | 라이선스 |
|---|---|---|
| react, react-dom | 19.x | MIT |
| vite | 8.x | MIT |
| tailwindcss, @tailwindcss/vite | 4.x | MIT |
| @tonejs/midi | 2.0.28 | MIT |
| opensheetmusicdisplay | 3.0.0 | BSD-3-Clause |
| jspdf | 4.2.1 | MIT |
| svg2pdf.js | 2.9.0 | MIT |
| NanumGothic 부분 글꼴(`public/fonts`) | - | OFL 1.1 (이름을 SoundStaffKR로 변경, 라이선스 파일 동봉) |

이후 단계에서 추가하는 라이브러리는 추가 시점에 확인해 기록한다.

## M2 구조

| 파일 | 역할 |
|---|---|
| `src/midi/quantize.ts` | 16분음표 격자 양자화, 박자표를 반영한 마디 경계 |
| `src/midi/measures.ts` | 화음 묶기, 성부 나누기(최대 4), 쉼표, 붙임줄, 박 정렬 음표 분해 |
| `src/score/toMusicXml.ts` | MusicXML 3.1 생성 |
| `src/score/validate.ts` | 마디 길이 합·붙임줄 짝 검사, XML 형식 검사 |
| `src/score/buildScore.ts` | 위 단계를 이어 악기별 악보 생성, 경고 수집 |

## M4 구조

| 파일 | 역할 |
|---|---|
| `src/piano/handSplit.ts` | 가온 도(60) 기준 오른손/왼손 나누기, 경계 부근 선율 트랙은 한 손에 고정 |
| `src/piano/playable.ts` | 한 손 동시 5음·음 폭 10도(16반음) 이내로 정리. 선율(오른손 최고음) > 베이스(왼손 최저음) > 안쪽 화음 순으로 남김 |
| `src/piano/reduce.ts` | 트랙 합치기, 중복 제거, 손별 정리, 제거 수 집계 |
| `src/components/OptionsPanel.tsx`, `UsageGuide.tsx`, `Notices.tsx`, `ChangeLog.tsx` | 변환 방식 선택, 사용 방법, 안내 문구 3종, 변경 이력 |

피아노 악보는 한 파트에 보표 2개로 작성하며 성부 번호는 보표마다 겹치지 않게(오른손 1~4, 왼손 5~8) 쓴다.

## M3 구조

| 파일 | 역할 |
|---|---|
| `src/components/ScoreView.tsx` | OSMD로 악보 표시, 확대·축소 |
| `src/components/ScorePanel.tsx` | 첨부 영역 하단 패널: 미리보기, PDF·MusicXML 다운로드, 파일이 여럿이면 탭 |
| `src/score/exportPdf.ts` | MusicXML → A4 세로 벡터 PDF (여러 쪽, 쪽 번호, 한글 글꼴 내장) |

PDF 글꼴: 한글 제목·트랙 이름이 깨지지 않도록 `public/fonts/SoundStaffKR-Regular.ttf`(NanumGothic에서 영문·한글 음절만 남긴 부분 글꼴, 약 1.3MB)를 PDF를 만들 때만 내려받아 내장한다.

## 검증 방법

앱에 포함하지 않는 개발용 검증: 공식 MusicXML 3.1 스키마(`musicxml.xsd`, https://github.com/w3c/musicxml 의 `v3.1` 태그)를 `xmllint --noout --nonet --schema`로 검사.

## 사용 환경 (작성자)

Finale 27.4 (Windows). 제목 글꼴은 MusicXML의 `credit-words`에 맑은 고딕(Malgun Gothic)으로 지정한다 (`src/score/toMusicXml.ts`). 한글 제목 정상 표시를 Finale에서 확인함.
화면은 다크 모드 전용이며, 미리보기 악보만 밝은 색으로 그린다. PDF는 흰 종이·검은 악보로 별도 생성한다.

## 알려진 사항

- OSMD는 템포 표시만 `14pt`·`times`·`xml:space="preserve"`로 그려서 svg2pdf가 PDF에 숫자를 빠뜨린다. `exportPdf.ts`의 `normalizeText`가 변환 직전에 형식을 맞춘다. OSMD를 올릴 때 다시 확인할 것.
- 빌드 결과(JS)가 약 2.2MB(gzip 630KB)다. OSMD·jsPDF를 지연 로딩하면 줄일 수 있다 (M7 검토).

- `@tonejs/midi`의 **쓰기** 기능은 조표를 잘못 기록하는 문제가 있다 (읽기는 정상). 피아노 MIDI 저장(M5) 때 조표 기록은 직접 검증한다.
- MIDI 텍스트(트랙 이름)는 인코딩이 규격에 없어, UTF-8·EUC-KR 복원을 시도한다 (`src/midi/readMidi.ts`).
- 16분음표 격자에 맞지 않는 리듬(3연음 등)은 가장 가까운 16분음표로 맞춘다. 시작 위치가 격자에서 크게 벗어난 음표가 10%를 넘으면 경고를 표시한다. 3연음 지원은 2차 버전 검토.
- 마디 중간의 템포 변화는 가장 가까운 마디 시작으로 옮긴다 (경고 표시).
- 세기(velocity), 페달, 피치 벤드는 악보에 반영하지 않는다.
- 성부는 먼저 시작한 음이 1성부가 된다. 낮은 음이 먼저 시작하면 그 뒤 선율이 2성부(줄기 아래 방향)가 될 수 있다. (피아노 합치기 M4에서 보정 예정)
