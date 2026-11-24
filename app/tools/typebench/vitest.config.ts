import { defineConfig } from 'vitest/config'

// 곡 유형별 정확도 시험 전용 설정. 일반 자동 시험(npm test)에는 들어가지 않는다.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('typebench') },
  test: { environment: 'node', include: ['tools/typebench/run.test.ts'], testTimeout: 3_600_000 },
})
