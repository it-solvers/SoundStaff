/// <reference lib="webworker" />
import './shim' // 반드시 가장 먼저: 작업 스레드에 window가 없어서 나는 오류를 막는다
import { estimateKey } from '../audio/key'
import { detectNotes } from '../audio/noteDetect'
import { MIN_MELODY_NOTES, selectMelody } from '../audio/melody'
import { filterNotes } from '../audio/notes'
import { refineNotes } from '../audio/spectrum'
import { trackBeats, usefulBeatTimes } from '../audio/beats'
import { estimateBpmFromAudio, estimateBpmFromNotes } from '../audio/tempo'
import type { AnalyzeRequest, AnalyzeResponse } from '../audio/workerTypes'

const post = (m: AnalyzeResponse) => self.postMessage(m)

/** 음원 분석은 무거워서 화면이 멈추지 않도록 별도 스레드에서 실행한다 (기획서 7장). 음원은 이 브라우저 밖으로 나가지 않는다. */
self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { pcm, sampleRate, modelUrl } = e.data
  const t0 = performance.now()
  try {
    const { raw, backend } = await detectNotes(pcm, modelUrl, (percent) => post({ type: 'progress', percent }))
    // 음표 정리 단계의 진행률(%): 주파수 분석이 대부분(0~90%)이고, 나머지는 템포·조성 추정(90~100%)
    let lastPercent = -1
    const finish = (percent: number) => {
      const p = Math.min(100, Math.max(0, Math.round(percent)))
      if (p === lastPercent) return
      lastPercent = p
      post({ type: 'stage', stage: 'finish', percent: p })
    }
    finish(0)
    // 기획서 8.5장: 거르기(3번). 거른 모든 음표는 "들리는 대로" 악보에, 그중 고른 한 줄 선율은 "멜로디만" 악보에 쓴다.
    // 소리의 주파수 분석으로 AI가 놓친 음은 채우고 근거 없는 음은 뺀다. 실패해도 AI 결과를 그대로 쓴다.
    const filtered = filterNotes(raw)
    let allNotes = filtered
    let refinedAdded = 0
    let refinedRemoved = 0
    try {
      const refined = refineNotes(pcm, sampleRate, filtered, (f) => finish(f * 85))
      allNotes = refined.notes
      refinedAdded = refined.added
      refinedRemoved = refined.removed
    } catch (err) {
      console.error(err)
    }
    finish(88)
    const notes = selectMelody(allNotes)
    if (allNotes.length < MIN_MELODY_NOTES) return post({ type: 'error', code: 'noNotes' })

    // 템포: 파형 기반 추정을 우선하고, 근거가 약하면 음표 간격으로 보완한다 (기획서 8.5장 4번)
    const fromAudio = estimateBpmFromAudio(pcm, sampleRate)
    const bpm =
      fromAudio && fromAudio.confidence >= 0.1
        ? fromAudio
        : estimateBpmFromNotes(
            allNotes.map((n) => n.startSec),
            allNotes.map((n) => n.velocity * Math.sqrt(n.durationSec)),
          )
    // 박 추적: 연주가 느려지거나 빨라지면(마디 템포가 6% 이상 바뀌면) 박 지도로 박 위치를 정한다. 실패해도 일정한 템포로 계속한다.
    let beatTimes: number[] | undefined
    try {
      beatTimes = usefulBeatTimes(trackBeats(pcm, sampleRate, bpm.value), bpm.value) ?? undefined
    } catch (err) {
      console.error(err)
    }
    finish(97)
    post({
      type: 'result',
      notes,
      allNotes,
      detectedCount: raw.length,
      refinedAdded,
      refinedRemoved,
      bpm,
      beatTimes,
      key: estimateKey(allNotes), // 모든 음으로 추정해야 멜로디 한 줄보다 조성이 안정적이다
      backend,
      elapsedMs: Math.round(performance.now() - t0),
    })
  } catch (err) {
    console.error(err)
    post({ type: 'error', code: 'failed' })
  }
}
