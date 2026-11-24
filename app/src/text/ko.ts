/**
 * 화면에 보이는 모든 문구 (한국어). 기획서 2.1장: 나중에 언어를 추가하기 쉽도록 문구는 이 파일에만 둔다.
 * 영어를 추가하면 같은 모양의 en.ts를 만들고 아래 `t`를 바꿔 끼우면 된다.
 */
export const ko = {
  appName: 'SoundStaff',
  // 음원 분석(M6)이 동작하기 전에는 "음원이나"를 뺀다 (없는 기능을 소개하지 않기 위해, 기획서 2.1장)
  tagline: '음원이나 MIDI 파일을 악보로 바꿔 줍니다. 파일은 내 컴퓨터를 떠나지 않습니다.',
  /** PC: 음원 분석이 무엇을 해 주는지 솔직하게 안내한다 (기획서 11.1장 기대 수준) */
  taglineNote:
    '음원은 소리만으로 들리는 음을 악보로 옮기는 초안이며 악기는 구분하지 못합니다. [멜로디만]으로 바꿀 수도 있습니다.',
  /** 폰·태블릿: 음원 분석을 제공하지 않으므로 MIDI만 소개한다 */
  taglineMidiOnly: 'MIDI 파일을 악보로 바꿔 줍니다. 파일은 내 기기를 떠나지 않습니다.',

  /** 기획서 11.1장: 항상 표시하는 안내 문구 3종 */
  notices: [
    '자동 변환 결과이며 정확하지 않을 수 있습니다. 악보 편집 프로그램에서 수정하세요.',
    '사용 권한이 있는 파일만 사용하세요. 무료 요금제로 만든 곡은 비상업적 용도로만 쓸 수 있는 경우가 있습니다.',
    '파일은 서버로 전송되지 않고 이 기기에서만 처리됩니다.',
  ],

  guide: {
    title: '사용 방법',
    steps: [
      {
        title: 'MIDI 또는 음원 첨부',
        desc: '파일을 끌어다 놓거나 [파일 선택]을 누르면 악보가 바로 만들어집니다. 음원(mp3, wav 등)은 PC에서 분석합니다.',
      },
      {
        title: '악보 다듬기 (선택)',
        desc: '출력 단위, 악기 순서·소리·빼기, 제목·템포·박자·조성을 고치면 악보가 바로 다시 만들어집니다.',
      },
      { title: '확인하고 저장', desc: '악보를 재생해 듣고 확대·축소해 보고 PDF, MusicXML, 피아노 MIDI로 저장합니다.' },
      { title: 'Finale에서 열기', desc: 'PC의 Finale에서 MusicXML을 열고 다른 이름으로 저장하면 .musx가 됩니다.' },
    ],
    /** 위쪽에 고정되는 단계 막대의 짧은 이름 (steps와 같은 순서) */
    short: ['첨부', '다듬기', '저장', 'Finale'],
    barLabel: (current: number, total: number, title: string, desc: string) => `${current}/${total} ${title}: ${desc}`,
    footer:
      '폰·태블릿에서는 MIDI 변환만 쓸 수 있고, 음원 분석은 PC에서 이용해 주세요. Finale는 PC에서만 열 수 있어 폰에서 받은 파일은 PC로 옮겨야 합니다.',
  },

  upload: {
    drop: 'MIDI 또는 음원 파일을 끌어다 놓거나 아래 버튼으로 선택하세요',
    dropMidiOnly: 'MIDI 파일을 끌어다 놓거나 아래 버튼으로 선택하세요',
    hint: '여러 파일을 한 번에 첨부할 수 있습니다 (MIDI: .mid, .midi 파일당 최대 5MB / 음원: 최대 50MB, 10분)',
    hintMidiOnly: '여러 파일을 한 번에 첨부할 수 있습니다 (.mid, .midi · 파일당 최대 5MB)',
    button: '파일 선택',
    reading: 'MIDI 파일을 읽는 중…',
  },

  /** 음원(mp3, wav 등) 분석 — 기획서 8.5장 */
  theme: {
    label: '화면 색',
    auto: '자동',
    light: '밝게',
    dark: '어둡게',
  },

  audio: {
    heading: '음원 파일 분석',
    pcOnly: 'PC 전용',
    button: '음원 파일 선택',
    hint: '.mp3, .wav, .m4a, .ogg, .flac · 최대 50MB, 10분 · MIDI가 없을 때 쓰세요',
    /** 멜로디만 방식 */
    warning: '음원에서 주 멜로디만 악보로 만들었습니다. 화음과 반주는 작곡가가 편곡으로 채워 주세요.',
    /** 들리는 대로 방식 (기본) */
    warningFull:
      '음원에서 들리는 음을 악보로 옮겼습니다. 악기는 구분하지 못해서 가온 도 기준으로 높은 음·낮은 음 두 단으로 나눴습니다.',
    /** 분석 전에 보여 주는 공통 안내 */
    warningGeneric:
      '음원은 소리만으로 음을 찾기 때문에 틀린 음이 있을 수 있고 악기는 구분하지 못합니다. 가능하면 MIDI를 사용하세요.',
    warningMore: '자동 분석 결과는 오류가 있을 수 있습니다. 가능하면 MIDI를 사용하세요.',
    vocalHint: '보컬만 분리된 파일(보컬 스템)을 올리면 훨씬 정확합니다.',
    simplify: {
      label: '읽기 쉽게 정리하기',
      desc: '같은 때 4음을 넘는 음과 겹쳐 이어지는 음을 정리해 악보를 단순하게 만듭니다. 일부 음이 빠집니다.',
    },
    mode: {
      legend: '악보 방식',
      full: {
        label: '들리는 대로',
        desc: '찾은 음을 모두 악보로 옮깁니다. 높은 음·낮은 음 두 단으로 나누고 같은 때의 음은 화음으로 묶습니다.',
      },
      melody: {
        label: '멜로디만',
        desc: '가장 두드러진 선율 한 줄만 만듭니다. 곡에 따라 엉뚱한 음이 골라질 수 있습니다.',
      },
    },
    phone: '음원 분석은 PC에서 이용해 주세요.',
    separateNote: '음원 분석 결과는 출력 단위와 상관없이 파일마다 따로 악보를 만듭니다.',
    trackName: 'Melody',
    trackRight: '오른손 (높은 음)',
    trackLeft: '왼손 (낮은 음)',
    trackSingle: 'Piano',
    estimated: '추정',
    stages: {
      decode: '음원을 읽는 중',
      resample: '분석용으로 변환하는 중',
      ai: 'AI가 음표를 찾는 중',
      finish: '음표를 정리하는 중',
    },
    cancel: '취소',
    analyzing: (name: string) => `분석 중: ${name}`,
    cancelled: '분석을 취소했습니다.',
    summary: (found: number, all: number, melody: number, backend: string, sec: number) =>
      `AI가 음표 ${found}개를 찾았고, 거른 ${all}개를 악보에 옮겼습니다. (멜로디만 고르면 ${melody}개) (${backend}, ${sec}초)`,
    guessed: '템포·박자·조성은 추정값입니다. 틀리면 [악보 설정]에서 고치세요.',
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
    metaAudio: (size: string, dur: string) => `음원 · ${size} · 길이 ${dur}`,
  },

  options: {
    unitLegend: '출력 단위',
    unit: {
      merged: { label: '합쳐서 악보 하나', desc: '첨부한 모든 파일을 한 곡으로 모아 악보 한 개를 만듭니다.' },
      separate: { label: '파일별로 각각 악보', desc: '파일마다 악보를 따로 만들고 PDF·MusicXML도 파일별로 받습니다.' },
    },
  },

  trackOrder: {
    heading: '악기 설정',
    hint: '순서: 끌어서 옮기거나 ▲▼ 버튼 · 🔊: 재생할 때만 소리 끄기(악보에는 그대로) · ✕: 악보에서 빼기. 바꾸면 악보가 다시 만들어집니다.',
    up: '위로',
    down: '아래로',
    mute: '소리 끄기 (재생할 때만, 악보에는 그대로 있습니다)',
    unmute: '소리 켜기',
    mutedBadge: '소리 꺼짐',
    remove: '악보에서 빼기',
    keepOne: '악기를 하나 이상 남겨야 합니다',
    removedHeading: '악보에서 뺀 악기',
    restore: '다시 넣기',
    reset: '원래대로',
    handle: '끌어서 옮기기',
    track: '트랙',
    notes: (n: number) => `${n}음`,
  },

  settings: {
    heading: '악보 설정',
    fromFile: (v: string) => `MIDI 값: ${v}`,
    estimatedValue: (v: string) => `추정값: ${v}`,
    title: '제목',
    composer: '작곡자',
    tempo: '템포 (BPM)',
    timeSignature: '박자',
    key: '조성',
    keyMajor: '장조',
    keyMinor: '단조',
    reset: 'MIDI 값으로 되돌리기',
    resetEstimated: '추정값으로 되돌리기',
    invalidTempo: '템포는 20~400 사이 숫자로 입력해 주세요.',
    invalidBeats: '박자의 윗수는 1~32 사이 정수로 입력해 주세요.',
    changedHint: '값을 바꾸면 악보가 바로 다시 만들어집니다.',
  },

  result: {
    warningsSummary: (n: number) => `알림 ${n}건 (눌러서 펼치기)`,
    done: (measures: number, parts: string) => `악보 생성 완료 · ${measures}마디 · ${parts}`,
    partsSummary: (list: string, n: number) => `파트 ${n}개 (${list})`,
    partItem: (name: string, notes: number) => `${name} ${notes}음`,
    error: (msg: string) => `악보를 만들지 못했습니다: ${msg}`,
  },

  /** 악보를 만드는 과정에서 나오는 경고 */
  warnings: {
    chordsDeduped: (n: number, total: number) =>
      `같은 칸에서 같은 높이로 겹친 음 ${n}개(전체 ${total}개 중)는 한 음으로 적었습니다. 소리는 같고 악보에 적힌 음에는 빠진 것이 없습니다.`,
    chordsTrimmed: (n: number, total: number) =>
      `읽기 쉽게 정리하면서 같은 칸에 겹친 같은 높이의 음과 한 번에 4음을 넘는 음 ${n}개(전체 ${total}개 중)를 뺐습니다.`,
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
    play: '재생',
    pause: '일시정지',
    resume: '이어서 재생',
    stop: '정지',
    speed: '속도',
    playHint: '악보에 표시된 음을 피아노 소리로 들려줍니다 (표시된 템포 기준).',
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
    unsupportedFormat: '지원하는 형식: mid, midi, mp3, wav, m4a, ogg, flac',
    analysisFailed: '음원 분석에 실패했습니다. 더 짧은 파일로 시도하거나 PC에서 이용해 주세요.',
    audioTooBig: (mb: string, maxMb: number) => `음원 파일이 너무 큽니다 (${mb}MB). 최대 ${maxMb}MB까지 지원합니다.`,
    audioTooLong: (maxMin: number) => `음원이 너무 깁니다. 최대 ${maxMin}분까지 지원합니다.`,
    noMemory: '브라우저 메모리가 부족할 수 있습니다. 더 짧은 파일로 시도하거나 PC에서 이용해 주세요.',
    phoneAudio: '음원 분석은 PC에서 이용해 주세요.',
    silent: '음원이 무음이거나 소리가 너무 작아 분석할 수 없습니다.',
    noDetected: '음을 찾지 못했습니다. 소리가 너무 작거나 잡음뿐인지 확인하고, 보컬 파일이나 MIDI로 시도해 주세요.',
    empty: '빈 파일입니다.',
    tooBig: (mb: string, maxMb: number) => `파일이 너무 큽니다 (${mb}MB). 최대 ${maxMb}MB까지 지원합니다.`,
    noNotes: '음표가 없는 파일입니다.',
    noPitched: '음 높이가 있는 트랙이 없습니다.',
    allRemoved: '악보에 넣을 악기가 없습니다. 악기를 하나 이상 남겨 주세요.',
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
