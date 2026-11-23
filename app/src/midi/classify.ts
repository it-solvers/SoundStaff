import type { TrackKind } from './types'

/** MIDI 10번 채널(코드상 채널 번호 9)은 드럼·타악기 전용이다. */
export const DRUM_CHANNEL_INDEX = 9

export function classifyTrack(opts: { channelIndex: number; percussion: boolean; noteCount: number }): TrackKind {
  if (opts.noteCount === 0) return 'empty'
  if (opts.percussion || opts.channelIndex === DRUM_CHANNEL_INDEX) return 'drum'
  return 'pitched'
}
