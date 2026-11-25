/**
 * GM(General MIDI) 타악기 번호 → 타악기 보표 위의 위치.
 * 위치는 널리 쓰는 드럼 기보를 따른다: 큰북 F4, 작은북 C5, 톰은 높이 순, 심벌·하이햇은 × 머리.
 * 라틴 타악기처럼 정해진 자리가 없는 악기는 비슷한 높이의 칸에 머리 모양을 달리해 놓는다.
 */
export type Notehead = 'normal' | 'x' | 'circle-x' | 'diamond' | 'triangle'

export interface DrumSound {
  /** 악기 이름 (MusicXML에 기록하는 GM 영어 이름) */
  name: string
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
  octave: number
  head: Notehead
  /** 발로 치는 악기: 아래 줄기의 2성부에 적는다 */
  foot?: boolean
}

type Row = [midi: number, name: string, position: string, head?: Notehead, foot?: boolean]

const ROWS: Row[] = [
  [35, 'Acoustic Bass Drum', 'E4', 'normal', true],
  [36, 'Bass Drum 1', 'F4', 'normal', true],
  [37, 'Side Stick', 'C5', 'x'],
  [38, 'Acoustic Snare', 'C5'],
  [39, 'Hand Clap', 'C5', 'triangle'],
  [40, 'Electric Snare', 'C5', 'diamond'],
  [41, 'Low Floor Tom', 'G4'],
  [42, 'Closed Hi-Hat', 'G5', 'x'],
  [43, 'High Floor Tom', 'A4'],
  [44, 'Pedal Hi-Hat', 'D4', 'x', true],
  [45, 'Low Tom', 'B4'],
  [46, 'Open Hi-Hat', 'G5', 'circle-x'],
  [47, 'Low-Mid Tom', 'D5'],
  [48, 'Hi-Mid Tom', 'E5'],
  [49, 'Crash Cymbal 1', 'A5', 'x'],
  [50, 'High Tom', 'F5'],
  [51, 'Ride Cymbal 1', 'F5', 'x'],
  [52, 'Chinese Cymbal', 'B5', 'circle-x'],
  [53, 'Ride Bell', 'F5', 'diamond'],
  [54, 'Tambourine', 'D5', 'triangle'],
  [55, 'Splash Cymbal', 'B5', 'diamond'],
  [56, 'Cowbell', 'E5', 'triangle'],
  [57, 'Crash Cymbal 2', 'B5', 'x'],
  [58, 'Vibraslap', 'A4', 'triangle'],
  [59, 'Ride Cymbal 2', 'F5', 'circle-x'],
  [60, 'Hi Bongo', 'E5'],
  [61, 'Low Bongo', 'D5'],
  [62, 'Mute Hi Conga', 'C5', 'x'],
  [63, 'Open Hi Conga', 'C5'],
  [64, 'Low Conga', 'A4'],
  [65, 'High Timbale', 'E5'],
  [66, 'Low Timbale', 'D5'],
  [67, 'High Agogo', 'G5', 'triangle'],
  [68, 'Low Agogo', 'E5', 'triangle'],
  [69, 'Cabasa', 'A5', 'triangle'],
  [70, 'Maracas', 'G5', 'triangle'],
  [71, 'Short Whistle', 'B5', 'triangle'],
  [72, 'Long Whistle', 'A5', 'diamond'],
  [73, 'Short Guiro', 'D5', 'x'],
  [74, 'Long Guiro', 'D5', 'circle-x'],
  [75, 'Claves', 'E5', 'x'],
  [76, 'Hi Wood Block', 'F5', 'triangle'],
  [77, 'Low Wood Block', 'D5', 'diamond'],
  [78, 'Mute Cuica', 'A4', 'x'],
  [79, 'Open Cuica', 'A4', 'diamond'],
  [80, 'Mute Triangle', 'A5', 'diamond'],
  [81, 'Open Triangle', 'C6', 'triangle'],
]

const MAP = new Map<number, DrumSound>(
  ROWS.map(([midi, name, position, head = 'normal', foot]) => [
    midi,
    { name, step: position[0] as DrumSound['step'], octave: Number(position.slice(1)), head, foot },
  ]),
)

/** GM 타악기 범위(35~81) 밖의 번호는 undefined */
export const drumSound = (midi: number): DrumSound | undefined => MAP.get(midi)
