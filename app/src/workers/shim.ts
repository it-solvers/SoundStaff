/**
 * 작업 스레드(Web Worker)에는 `window`가 없는데 AI 라이브러리(TensorFlow.js) 일부가 `window`를 찾는다.
 * 이를 가장 먼저 채워 둬서 "window is not defined" 오류를 막는다. (analyze.worker.ts에서 제일 먼저 가져온다)
 */
const g = globalThis as { window?: unknown }
g.window ??= globalThis
