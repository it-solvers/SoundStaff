/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/wasm'
// 실행기(wasm) 파일을 빌드 결과에 포함하고 그 주소를 알려 준다 (패키지의 내보내기 목록에 없어 경로로 가져온다)
import mjsUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url'
import wasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url'
import { MODEL_BINS, separateVocals } from '../audio/separate'
import type { SeparateRequest, SeparateResponse } from '../audio/workerTypes'

ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl }

const post = (m: SeparateResponse, transfer: Transferable[] = []) => self.postMessage(m, { transfer })

/** 목소리 분리는 무겁고 메모리를 많이 써서 별도 스레드에서 하고, 끝나면 스레드를 없앤다. 음원은 이 브라우저 밖으로 나가지 않는다. */
self.onmessage = async (e: MessageEvent<SeparateRequest>) => {
  const { left, right, modelUrl } = e.data
  try {
    const session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] })
    const done = await separateVocals(
      left,
      right,
      async (mag, frames) => {
        const input = new ort.Tensor('float32', mag, [1, 2, MODEL_BINS, frames])
        const result = await session.run({ [session.inputNames[0]]: input })
        return result[session.outputNames[0]].data as Float32Array
      },
      (percent) => post({ type: 'progress', percent: Math.round(percent) }),
    )
    post({ type: 'result', vocals: done.vocals, ratio: done.ratio }, [done.vocals.buffer])
  } catch (err) {
    console.error(err)
    post({ type: 'error' })
  }
}
