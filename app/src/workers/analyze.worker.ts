/// <reference lib="webworker" />
import './shim' // 반드시 가장 먼저: 작업 스레드에 window가 없어서 나는 오류를 막는다
import { estimateKey } from '../audio/key'
import { detectNotes } from '../audio/noteDetect'
import { MIN_MELODY_NOTES, selectMelody } from '../audio/melody'
import { filterNotes } from '../audio/notes'
import { estimateBpmFromAudio, estimateBpmFromNotes } from '../audio/tempo'
import type { AnalyzeRequest, AnalyzeResponse } from '../audio/workerTypes'

const post = (m: AnalyzeResponse) => self.postMessage(m)

/** 음원 분석은 무거워서 화면이 멈추지 않도록 별도 스레드에서 실행한다 (기획서 7장). 음원은 이 브라우저 밖으로 나가지 않는다. */
self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { pcm, sampleRate, modelUrl } = e.data
  const t0 = performance.now()
  try {
    const { raw, backend } = await detectNotes(pcm, modelUrl, (percent) => post({ type: 'progress', percent }))
    post({ type: 'stage', stage: 'finish' })
    // 기획서 8.5장: 거르기(3번) → 주 멜로디 선택(4번). 결과는 겹치는 음이 없는 한 줄 선율이다.
    const notes = selectMelody(filterNotes(raw))
    if (notes.length < MIN_MELODY_NOTES) return post({ type: 'error', code: 'noNotes' })

    // 템포: 파형 기반 추정을 우선하고, 근거가 약하면 음표 간격으로 보완한다 (기획서 8.5장 4번)
    const fromAudio = estimateBpmFromAudio(pcm, sampleRate)
    const bpm =
      fromAudio && fromAudio.confidence >= 0.1
        ? fromAudio
        : estimateBpmFromNotes(
            notes.map((n) => n.startSec),
            notes.map((n) => n.velocity * Math.sqrt(n.durationSec)),
          )
    post({
      type: 'result',
      notes,
      detectedCount: raw.length,
      bpm,
      key: estimateKey(notes),
      backend,
      elapsedMs: Math.round(performance.now() - t0),
    })
  } catch (err) {
    console.error(err)
    post({ type: 'error', code: 'failed' })
  }
}
