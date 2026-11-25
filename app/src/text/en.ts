import type { Messages } from './ko'

/** "1 note", "2 notes" */
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** 화면에 보이는 모든 문구 (영어). 모양은 ko.ts와 같아야 한다 (다르면 타입 검사에서 걸린다). */
export const en: Messages = {
  appName: 'SoundStaff',
  language: { label: '한국어', lang: 'ko', href: '../' },
  tagline: 'Turn audio or MIDI files into sheet music. Your files never leave your computer.',
  taglineNote:
    'Audio results are a draft of the notes picked up from the sound alone, and instruments are not told apart. You can also switch to [Melody only].',
  fitGuide: {
    heading: 'Where audio analysis works well',
    items: [
      { label: 'Good', text: 'A single melody line on one instrument, such as piano (including isolated vocals)' },
      {
        label: 'Fair',
        text: 'Overlapping notes, such as two-hand piano or choir: expect a few missing or extra notes',
      },
      { label: 'Rough', text: 'Mixed instruments: many wrong notes, so try [Melody only] or use MIDI' },
    ],
    note: 'Trends seen on our own test pieces; real songs may score lower. MIDI files do not have this limitation.',
  },
  taglineMidiOnly: 'Turn MIDI files into sheet music. Your files never leave your device.',

  notices: [
    'Results are converted automatically and may be inaccurate. Please correct them in a notation editor.',
    'Only use files you have the right to use. Songs made on a free plan may be limited to non-commercial use.',
    'Files are not sent to any server. They are processed only on this device.',
  ],

  guide: {
    title: 'How to use',
    steps: [
      {
        title: 'Add MIDI or audio',
        desc: 'Drop files or press [Choose files] and the score is made right away. Audio (mp3, wav, etc.) is analyzed on a computer.',
      },
      {
        title: 'Refine the score (optional)',
        desc: 'Change the output unit, instrument order, sound or removal, title, tempo, time or key, and the score is rebuilt right away.',
      },
      { title: 'Check and save', desc: 'Play the score, zoom in or out, and save it as PDF, MusicXML or piano MIDI.' },
      {
        title: 'Open in Finale',
        desc: 'Open the MusicXML in Finale on a computer and use Save As to get a .musx file.',
      },
    ],
    short: ['Add', 'Refine', 'Save', 'Finale'],
    barLabel: (current: number, total: number, title: string, desc: string) => `${current}/${total} ${title}: ${desc}`,
    footer:
      'Phones and tablets can only convert MIDI; please analyze audio on a computer. Finale runs only on computers, so move files saved on a phone to a computer.',
  },

  upload: {
    drop: 'Drop MIDI or audio files here, or choose them with the button below',
    dropMidiOnly: 'Drop MIDI files here, or choose them with the button below',
    hint: 'You can add several files at once (MIDI: .mid, .midi up to 5MB each / audio: up to 50MB, 10 minutes)',
    hintMidiOnly: 'You can add several files at once (.mid, .midi · up to 5MB each)',
    button: 'Choose files',
    reading: 'Reading MIDI files…',
  },

  theme: {
    label: 'Color theme',
    auto: 'Auto',
    light: 'Light',
    dark: 'Dark',
  },

  audio: {
    heading: 'Audio analysis',
    pcOnly: 'Computer only',
    button: 'Choose audio files',
    hint: '.mp3, .wav, .m4a, .ogg, .flac · up to 50MB, 10 minutes · use when you have no MIDI',
    warning: 'Only the main melody was written from the audio. Add chords and accompaniment in your own arrangement.',
    warningFull:
      'The notes heard in the audio were written to the score. Instruments are not told apart, so they are split into a high and a low staff at middle C.',
    warningGeneric:
      'Notes are found from sound alone, so songs with mixed instruments have many wrong notes and instruments are not told apart. Treat audio results as a draft and use MIDI when you can.',
    warningMore: 'Automatic analysis can contain errors. Use MIDI when you can.',
    vocalHint: 'An isolated vocal file (vocal stem) gives much better results.',
    edit: {
      label: 'Easy to edit (for Finale)',
      desc: 'Joins repeated notes into one and keeps each staff to a single voice (chords). Very short and overlapping notes may be dropped, but the score is much easier to fix in Finale. Turn off to keep as many notes as possible.',
    },
    emphasis: {
      label: 'Highlight main notes',
      desc: 'Loud, long notes are drawn in black and quiet, short ones in gray. No notes are removed. (Visible in the preview and PDF; Finale may not show the color.)',
    },
    merge: {
      label: 'Join repeated notes',
      desc: 'Writes consecutive notes of the same pitch as one long note so the score is not chopped up. Turn off to keep the notes as the AI split them.',
    },
    simplify: {
      label: 'Simplify for reading',
      desc: 'Thins out overlapping notes and more than 4 notes at once to make a simpler score. Some notes are dropped.',
    },
    mode: {
      legend: 'Score style',
      full: {
        label: 'As heard',
        desc: 'Writes every note found, split into high and low staves, with simultaneous notes grouped as chords.',
      },
      melody: {
        label: 'Melody only',
        desc: 'Writes only the most prominent melody line. Depending on the song, wrong notes may be picked.',
      },
    },
    phone: 'Please analyze audio on a computer.',
    separateNote: 'Audio results always get one score per file, whatever the output unit is.',
    trackName: 'Melody',
    trackRight: 'Right hand (high)',
    trackLeft: 'Left hand (low)',
    trackSingle: 'Piano',
    estimated: 'estimated',
    stages: {
      decode: 'Reading the audio',
      resample: 'Preparing for analysis',
      ai: 'AI is finding notes',
      finish: 'Cleaning up notes',
    },
    cancel: 'Cancel',
    analyzing: (name: string) => `Analyzing: ${name}`,
    cancelled: 'Analysis canceled.',
    summary: (found: number, all: number, melody: number, backend: string, sec: number) =>
      `The AI found ${count(found, 'note')}; ${all} remained after filtering and were written to the score. (Melody only: ${melody}) (${backend}, ${sec}s)`,
    refined: (added: number, removed: number) =>
      `A second look at the sound frequencies added ${count(added, 'note')} the AI missed and removed ${removed} without support. Added notes are given low loudness, so they usually appear gray (less prominent).`,
    guessed: 'Tempo, time signature and key are estimates. Correct them in [Score settings] if needed.',
  },

  files: {
    heading: (n: number) => `File details (${count(n, 'file')})`,
    clearAll: 'Clear all',
    failedHeading: 'Files that could not be read',
    tempo: 'Tempo',
    timeSignature: 'Time',
    key: 'Key',
    notInFile: 'not in file',
    noKey: 'No information',
    changes: (n: number) => ` (${count(n, 'change')})`,
    columns: {
      track: 'Track name',
      instrument: 'Instrument',
      channel: 'Channel',
      notes: 'Notes',
      range: 'Range',
      kind: 'Type',
    },
    unnamed: '(unnamed)',
    drumInstrument: 'Drums/percussion',
    drum: 'Drums',
    trackNumber: (n: number) => `Track ${n}`,
    andMore: (first: string, n: number) => `${first} and ${n} more`,
    kind: { drum: 'Percussion', empty: 'No notes', pitched: 'Pitched' },
    meta: (size: string, dur: string, ppq: number) => `${size} · length ${dur} · resolution ${ppq} PPQ`,
    metaAudio: (size: string, dur: string) => `Audio · ${size} · length ${dur}`,
  },

  keys: {
    name: (tonic: string, minor: boolean) => `${tonic} ${minor ? 'minor' : 'major'}`,
    noSignature: 'no key signature',
    noAccidentals: 'no ♯♭',
    flats: (n: number) => `${n}♭`,
    sharps: (n: number) => `${n}♯`,
  },

  options: {
    unitLegend: 'Output unit',
    unit: {
      merged: { label: 'One combined score', desc: 'Puts all added files together as one piece in a single score.' },
      separate: { label: 'One score per file', desc: 'Makes a separate score, PDF and MusicXML for each file.' },
    },
  },

  trackOrder: {
    heading: 'Instruments',
    hint: 'Check several to change them at once · Order: drag or use ▲▼ · Speaker: mutes during playback only (stays in the score) · ✕: removes from the score. The score is rebuilt after changes.',
    hintFixed:
      'This is a piano grand staff with the right hand (high) on top and the left hand (low) below, so the order is fixed. Speaker: mutes during playback only (stays in the score) · ✕: removes from the score.',
    up: 'Move up',
    down: 'Move down',
    mute: 'Mute (playback only; stays in the score)',
    unmute: 'Unmute',
    mutedBadge: 'Muted',
    remove: 'Remove from score',
    keepOne: 'Keep at least one instrument',
    removedHeading: 'Removed instruments',
    restore: 'Restore',
    restoreAll: 'Restore all',
    select: 'Select',
    selectAll: 'Select all',
    selected: (n: number) => `${n} selected`,
    muteSelected: 'Mute',
    unmuteSelected: 'Unmute',
    removeSelected: 'Remove from score',
    reset: 'Reset',
    handle: 'Drag to move',
    track: 'Track',
    notes: (n: number) => count(n, 'note'),
  },

  settings: {
    heading: 'Score settings',
    fromFile: (v: string) => `From MIDI: ${v}`,
    estimatedValue: (v: string) => `Estimated: ${v}`,
    title: 'Title',
    composer: 'Composer',
    tempo: 'Tempo (BPM)',
    timeSignature: 'Time signature',
    beatsTop: 'Time signature, top number',
    beatsBottom: 'Time signature, bottom number',
    key: 'Key',
    keyMajor: 'major',
    keyMinor: 'minor',
    reset: 'Reset to MIDI values',
    resetEstimated: 'Reset to estimates',
    invalidTempo: 'Enter a tempo between 20 and 400.',
    tempoOctaveHint:
      'With audio, the tempo is sometimes detected at half or double speed. Try these if the notes look too dense or too sparse.',
    tempoHalf: (bpm: number) => `Half (${bpm} BPM)`,
    tempoDouble: (bpm: number) => `Double (${bpm} BPM)`,
    invalidBeats: 'Enter a whole number between 1 and 32 for the top number.',
    changedHint: 'The score is rebuilt as soon as you change a value.',
  },

  result: {
    warningsSummary: (n: number) => `${count(n, 'message')} (click to expand)`,
    done: (measures: number, parts: string) => `Score ready · ${count(measures, 'measure')} · ${parts}`,
    partsSummary: (list: string, n: number) => `${count(n, 'part')} (${list})`,
    partItem: (name: string, notes: number) => `${name}: ${count(notes, 'note')}`,
    error: (msg: string) => `Could not make the score: ${msg}`,
  },

  warnings: {
    notesMerged: (n: number, total: number) =>
      `Repeated notes of the same pitch were joined to the note before (${n} of ${total} found by the AI). The sounding time is unchanged.`,
    chordsDeduped: (n: number, total: number) =>
      `Notes of the same pitch overlapping in the same slot were written once (${n} of ${total}). Nothing is missing from the written pitches.`,
    chordsTrimmed: (n: number, total: number) =>
      `Simplifying removed ${n} of ${total} notes: duplicates in the same slot, notes beyond 4 at once, and gray notes with no free voice.`,
    offGrid: (pct: number) =>
      `${pct}% of notes are far off the 16th-note grid. Triplets and the like are moved to the nearest 16th note, so rhythms may differ.`,
    unsupportedTimeSignature:
      'An unsupported time signature (bottom number other than 1, 2, 4, 8 or 16) was treated as 4/4. You can change it in [Score settings].',
    snappedTempo: (n: number) =>
      `Tempo changes inside a measure were moved to the nearest measure start (${count(n, 'change')}).`,
    unknownDrums: (n: number) =>
      `Notes with unknown percussion numbers were left out of the score (${count(n, 'note')}).`,
    drumsSilent: 'Percussion is in the score, PDF and MusicXML, but it is not yet heard in playback here.',
    voicesMerged: (max: number, n: number) =>
      `More than ${max} voices sounded at once, so some notes were merged into chords (${count(n, 'note')}).`,
    voicesTrimmed: (max: number, n: number) =>
      `More than ${max} voices sounded at once, so some notes were shortened (${count(n, 'note')}).`,
    hand: (hand: string, msg: string) => `${hand}: ${msg}`,
    track: (name: string, msg: string) => `${name}: ${msg}`,
    merge: {
      tempo: (file: string, a: string, b: string) =>
        `The tempo of ${file} (${a}) differs from the first file (${b}); the first file is used.`,
      timeSignature: (file: string, a: string, b: string) =>
        `The time signature of ${file} (${a}) differs from the first file (${b}); the first file is used. You can change it in [Score settings].`,
      key: (file: string, a: string, b: string) =>
        `The key of ${file} (${a}) differs from the first file (${b}); the first file is used.`,
    },
  },

  panel: {
    heading: 'Score preview',
    pdf: 'Download PDF',
    pdfBusy: 'Making PDF…',
    musicXml: 'Download MusicXML',
    pianoMidi: 'Download piano MIDI',
    pianoMidiHint: 'A MIDI file with every pitched instrument set to piano (percussion excluded).',
    zip: 'Make ZIP of everything',
    zipReady: (name: string) => `Save ZIP (${name})`,
    zipName: (app: string) => `${app} scores.zip`,
    pianoMidiName: (base: string) => `${base} piano.mid`,
    zipHint: 'All files are ready. Click the link below to save them.',
    zipBusy: (done: number, total: number) => `Making ZIP… (${done}/${total})`,
    play: 'Play',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    speed: 'Speed',
    timbre: 'Sound',
    timbres: {
      grandPiano: 'Real piano',
      piano: 'Synth piano',
      organ: 'Organ',
      strings: 'Strings',
      flute: 'Flute',
      bell: 'Bell',
      harpsichord: 'Harpsichord',
    },
    playHint:
      'Plays the notes in the score with the chosen sound, at the written tempo. [Real piano] uses recorded piano; the others are computer-generated and differ from real instruments.',
    loading: 'Loading piano sounds…',
    fallback: 'Could not load the real piano sound, so the synth piano is used.',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    drawing: 'Drawing the score…',
    pdfSettings: 'PDF settings',
    orientation: 'Paper',
    portrait: 'A4 portrait',
    landscape: 'A4 landscape',
    size: 'Score size',
    sizes: { small: 'Small', normal: 'Normal', large: 'Large' },
    finaleHelp:
      'Open MusicXML (a standard score exchange format) in Finale (a notation program) with File → Open (or Import). Finale runs only on computers, so move files saved on a phone to a computer first. Results are converted automatically, so check and correct them in Finale.',
  },

  changelog: { title: 'Change log' },

  footer: {
    copyright: '© 2026 아이티해결단 (it-solvers)',
    license: 'MIT License',
    credit: 'Piano sound: Salamander Grand Piano (Alexander Holm, CC BY 3.0)',
  },

  errors: {
    unreadable: 'Could not read the file. Please try another one.',
    unsupportedFormat: 'Supported formats: mid, midi, mp3, wav, m4a, ogg, flac',
    analysisFailed: 'Audio analysis failed. Try a shorter file or use a computer.',
    audioTooBig: (mb: string, maxMb: number) => `The audio file is too large (${mb}MB). The limit is ${maxMb}MB.`,
    audioTooLong: (maxMin: number) => `The audio is too long. The limit is ${maxMin} minutes.`,
    noMemory: 'The browser may run out of memory. Try a shorter file or use a computer.',
    phoneAudio: 'Please analyze audio on a computer.',
    silent: 'The audio is silent or too quiet to analyze.',
    noDetected:
      'No notes were found. Check that the audio is not too quiet or just noise, and try a vocal file or MIDI.',
    empty: 'The file is empty.',
    tooBig: (mb: string, maxMb: number) => `The file is too large (${mb}MB). The limit is ${maxMb}MB.`,
    noNotes: 'The file has no notes.',
    allRemoved: 'No instruments are left for the score. Keep at least one.',
    structure: (detail: string) => `The score failed its structure check: ${detail}`,
    validation: {
      staff: (part: string, n: number) => `${part} staff ${n}`,
      length: (where: string, measure: number, voice: number, sum: number, len: number) =>
        `${where}: measure ${measure}, voice ${voice} length ${sum} ≠ measure length ${len}`,
      tieNoStart: (where: string, measure: number, voice: number) =>
        `${where}: measure ${measure}, voice ${voice} has a tie ending without a start`,
      openTie: (where: string) => `${where}: a tie is never closed`,
      xml: (detail: string) => `XML format error: ${detail}`,
    },
    outline: 'Invalid glyph outline coordinates.',
    retry: 'Please try again.',
    pdfFailed: (msg: string) => `Could not make the PDF: ${msg} Please try again.`,
    pdfFont: 'Could not load the font file for the PDF.',
    pdfNoPages: 'The score was not drawn, so a PDF cannot be made.',
    downloadFailed: (msg: string) => `Could not make the file: ${msg} Please try again.`,
    viewFailed: (msg: string) => `Could not draw the score on screen: ${msg}`,
    unexpected: 'Something went wrong. Reload the page and try again. If it keeps happening, try another file.',
    unsupportedBrowser: 'This browser lacks required features. Please use a recent Chrome or Edge.',
    reload: 'Reload',
  },
}
