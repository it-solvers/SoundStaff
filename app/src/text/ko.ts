/**
 * 화면에 보이는 모든 문구 (한국어). 기획서 2.1장: 나중에 언어를 추가하기 쉽도록 문구는 이 파일에만 둔다.
 * 영어를 추가하면 같은 모양의 en.ts를 만들고 아래 `t`를 바꿔 끼우면 된다.
 */
export const ko = {
  appName: 'SoundStaff',
  // 음원 분석(M6)이 동작하기 전에는 "음원이나"를 뺀다 (없는 기능을 소개하지 않기 위해, 기획서 2.1장)
  tagline: 'MIDI 파일을 악보로 바꿔 줍니다. 파일은 내 컴퓨터를 떠나지 않습니다.',

  /** 기획서 11.1장: 항상 표시하는 안내 문구 3종 */
  notices: [
    '자동 변환 결과이며 정확하지 않을 수 있습니다. 악보 편집 프로그램에서 수정하세요.',
    '사용 권한이 있는 파일만 사용하세요. 무료 요금제로 만든 곡은 비상업적 용도로만 쓸 수 있는 경우가 있습니다.',
    '파일은 서버로 전송되지 않고 이 기기에서만 처리됩니다.',
  ],

  guide: {
    title: '사용 방법',
    steps: [
      { title: 'MIDI 파일 첨부', desc: '파일을 끌어다 놓거나 [파일 선택]을 누릅니다. 여러 파일도 한 번에 됩니다.' },
      { title: '방식 선택', desc: '악보를 하나로 합칠지 파일별로 만들지, 피아노로 합칠지 악기별로 만들지 고릅니다.' },
      { title: '[악보 만들기]', desc: '필요하면 박자·템포·조성·제목을 고치고 버튼을 누르면 아래에 악보가 나타납니다.' },
      { title: '확인하고 저장', desc: '악보를 확대·축소해 보고 PDF, MusicXML, 피아노 MIDI로 저장합니다.' },
      { title: 'Finale에서 열기', desc: 'PC의 Finale에서 MusicXML을 열고 다른 이름으로 저장하면 .musx가 됩니다.' },
    ],
    /** 위쪽에 고정되는 단계 막대의 짧은 이름 (steps와 같은 순서) */
    short: ['첨부', '방식', '만들기', '저장', 'Finale'],
    openGuide: '자세히',
    barLabel: (current: number, total: number, title: string, desc: string) => `${current}/${total} ${title}: ${desc}`,
    footer:
      'MIDI가 없을 때 쓰는 음원(mp3, wav) 분석은 준비 중입니다. 폰·태블릿에서도 1~4단계를 쓸 수 있고, Finale는 PC에서만 열 수 있어 파일을 PC로 옮겨야 합니다.',
  },

  upload: {
    drop: 'MIDI 파일을 끌어다 놓거나 아래 버튼으로 선택하세요',
    hint: '여러 파일을 한 번에 첨부할 수 있습니다 (.mid, .midi · 파일당 최대 5MB)',
    button: '파일 선택',
    reading: 'MIDI 파일을 읽는 중…',
  },

  files: {
    heading: (n: number) => `읽은 정보 (${n}개 파일)`,
    clearAll: '모두 지우기',
    failedHeading: '읽지 못한 파일',
    tempo: '템포',
    timeSignature: '박자',
    key: '조성',
    notInFile: '파일에 없음',
    noKey: '정보 없음',
    changes: (n: number) => ` (변화 ${n}회)`,
    columns: { track: '트랙 이름', instrument: '악기', channel: '채널', notes: '음표 수', range: '음역', kind: '구분' },
    unnamed: '(이름 없음)',
    drumInstrument: '드럼/타악기',
    kind: { drum: '드럼 · 악보 제외', empty: '음표 없음', pitched: '음높이 악기' },
    drumNotice: (n: number) =>
      `드럼 트랙 ${n}개는 악보에서 제외됩니다. (드럼은 음높이가 없는 타악기 소리라 일반 악보로 옮기지 않습니다)`,
    meta: (size: string, dur: string, ppq: number) => `${size} · 길이 ${dur} · 해상도 ${ppq} PPQ`,
  },

  options: {
    unitLegend: '출력 단위',
    unit: {
      merged: { label: '합쳐서 악보 하나', desc: '첨부한 모든 파일을 한 곡으로 모아 악보 한 개를 만듭니다.' },
      separate: { label: '파일별로 각각 악보', desc: '파일마다 악보를 따로 만들고 PDF·MusicXML도 파일별로 받습니다.' },
    },
    modeLegend: '변환 방식',
    mode: {
      piano: {
        label: '피아노로 합치기',
        desc: '모든 악기를 오른손·왼손 두 줄로 합칩니다. 한 손으로 칠 수 있게 일부 음은 빠집니다.',
      },
      instrument: { label: '악기별 악보', desc: '악기(트랙)마다 한 줄씩 악보를 만듭니다. 음은 빠지지 않습니다.' },
    },
  },

  settings: {
    heading: '악보 설정',
    fromFile: (v: string) => `MIDI 값: ${v}`,
    title: '제목',
    composer: '작곡자',
    tempo: '템포 (BPM)',
    timeSignature: '박자',
    key: '조성',
    keyMajor: '장조',
    keyMinor: '단조',
    reset: 'MIDI 값으로 되돌리기',
    invalidTempo: '템포는 20~400 사이 숫자로 입력해 주세요.',
    invalidBeats: '박자의 윗수는 1~32 사이 정수로 입력해 주세요.',
    changedHint: '값을 바꾸면 이미 만든 악보가 다시 만들어집니다.',
  },

  build: { button: '악보 만들기' },

  result: {
    done: (measures: number, parts: string) => `악보 생성 완료 · ${measures}마디 · ${parts}`,
    partsSummary: (list: string, n: number) => `파트 ${n}개 (${list})`,
    partItem: (name: string, notes: number) => `${name} ${notes}음`,
    error: (msg: string) => `악보를 만들지 못했습니다: ${msg}`,
    reduction: {
      heading: '피아노로 합친 결과',
      flow: (input: number, dup: number, right: number, left: number) => ({
        before: `원본 음표 ${input}개 → 중복 ${dup}개 합침 → 한 손으로 칠 수 있게 `,
        after: `개 제거 → 오른손 ${right}개 · 왼손 ${left}개`,
      }),
      removedDetail: (removed: number, pct: number, byCount: number, bySpan: number) =>
        `제거한 음 ${removed}개 (${pct}%): 동시에 5개를 넘어서 ${byCount}개, 한 손 음 폭이 10도를 넘어서 ${bySpan}개`,
      pinned: (list: string) => `경계(가온 도) 부근 선율이 끊기지 않게 한 손에 고정: ${list}`,
      right: '오른손',
      left: '왼손',
      caveat: '자동으로 합친 피아노 악보는 사람이 편곡한 것만큼 연주하기 좋지 않습니다. Finale에서 손봐 주세요.',
    },
  },

  /** 악보를 만드는 과정에서 나오는 경고 */
  warnings: {
    offGrid: (pct: number) =>
      `음표의 ${pct}%가 16분음표 격자에서 크게 벗어나 있습니다. 3연음 등은 가장 가까운 16분음표 위치로 맞춰지므로 리듬이 달라질 수 있습니다.`,
    unsupportedTimeSignature:
      '지원하지 않는 박자표(분모가 1·2·4·8·16이 아님)가 있어 해당 구간을 4/4로 처리했습니다. 박자는 [악보 설정]에서 고칠 수 있습니다.',
    snappedTempo: (n: number) => `마디 중간에 있는 템포 변화 ${n}개를 가장 가까운 마디 시작으로 옮겼습니다.`,
    drumsExcluded: (n: number) => `드럼 트랙 ${n}개는 악보에서 제외했습니다.`,
    voicesMerged: (max: number, n: number) =>
      `동시에 울리는 성부가 ${max}개를 넘어 일부 음 ${n}개를 화음으로 합쳤습니다.`,
    voicesTrimmed: (max: number, n: number) => `성부가 ${max}개를 넘어 일부 음 ${n}개의 길이를 줄였습니다.`,
    hand: (hand: string, msg: string) => `${hand}: ${msg}`,
    track: (name: string, msg: string) => `${name}: ${msg}`,
    merge: {
      tempo: (file: string, a: string, b: string) =>
        `${file}의 템포(${a})가 첫 번째 파일(${b})과 달라 첫 번째 파일 기준으로 맞췄습니다.`,
      timeSignature: (file: string, a: string, b: string) =>
        `${file}의 박자(${a})가 첫 번째 파일(${b})과 달라 첫 번째 파일 기준으로 맞췄습니다. 박자는 [악보 설정]에서 고칠 수 있습니다.`,
      key: (file: string, a: string, b: string) =>
        `${file}의 조성(${a})이 첫 번째 파일(${b})과 달라 첫 번째 파일 기준으로 맞췄습니다.`,
    },
  },

  panel: {
    heading: '악보 미리보기',
    pdf: 'PDF 다운로드',
    pdfBusy: 'PDF 만드는 중…',
    musicXml: 'MusicXML 다운로드',
    pianoMidi: '피아노 MIDI 다운로드',
    pianoMidiHint: '모든 음높이 악기를 피아노 소리로 통일한 MIDI입니다 (드럼 제외).',
    zip: '전체 ZIP 만들기',
    zipReady: (name: string) => `ZIP 저장 (${name})`,
    zipHint: '파일이 모두 만들어졌습니다. 아래 링크를 눌러 저장하세요.',
    zipBusy: (done: number, total: number) => `ZIP 만드는 중… (${done}/${total})`,
    zoomIn: '확대',
    zoomOut: '축소',
    drawing: '악보를 그리는 중…',
    pdfSettings: 'PDF 설정',
    orientation: '용지',
    portrait: 'A4 세로',
    landscape: 'A4 가로',
    size: '악보 크기',
    sizes: { small: '작게', normal: '보통', large: '크게' },
    finaleHelp:
      'MusicXML(뮤직엑스엠엘, 악보 교환용 표준 파일 형식)은 Finale(피날레, 악보 제작 프로그램)에서 파일 → 열기(또는 가져오기)로 불러옵니다. Finale는 PC에서만 쓸 수 있으므로 폰에서 받았다면 PC로 옮겨서 여세요. 자동 변환 결과이므로 Finale에서 확인하고 고쳐 주세요.',
  },

  changelog: { title: '변경 이력' },

  /** 화면 맨 아래 저작권 표시 (LICENSE의 표기와 같게) */
  footer: { copyright: '© 2026 아이티해결단', license: 'MIT 라이선스' },

  /** 기획서 11.3장 오류 처리 목록 */
  errors: {
    unreadable: '파일을 읽을 수 없습니다. 다른 파일로 시도해 주세요.',
    unsupportedFormat: '지원하는 형식: mid, midi (음원 파일은 아직 지원하지 않습니다)',
    empty: '빈 파일입니다.',
    tooBig: (mb: string, maxMb: number) => `파일이 너무 큽니다 (${mb}MB). 최대 ${maxMb}MB까지 지원합니다.`,
    noNotes: '음표가 없는 파일입니다.',
    noPitched: '음 높이가 있는 트랙이 없습니다.',
    structure: (detail: string) => `악보 구조 검증에 실패했습니다: ${detail}`,
    retry: '다시 시도해 주세요.',
    pdfFailed: (msg: string) => `PDF를 만들지 못했습니다: ${msg} 다시 시도해 주세요.`,
    pdfFont: 'PDF용 한글 글꼴 파일을 불러오지 못했습니다.',
    pdfNoPages: '악보가 그려지지 않아 PDF를 만들 수 없습니다.',
    downloadFailed: (msg: string) => `파일을 만들지 못했습니다: ${msg} 다시 시도해 주세요.`,
    viewFailed: (msg: string) => `악보를 화면에 그리지 못했습니다: ${msg}`,
    unexpected: '문제가 생겼습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요. 계속되면 다른 파일로 시도해 보세요.',
    unsupportedBrowser: '이 브라우저는 필요한 기능을 지원하지 않습니다. 최신 Chrome 또는 Edge에서 이용해 주세요.',
    reload: '새로고침',
  },
}

/** 지금 쓰는 문구. 언어를 추가하면 여기서 고른다. */
export const t = ko
