import { defineConfig } from 'vitest/config'

// 자동 시험 설정 (기획서 11.2장). 브라우저 없이 Node에서 실행한다.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
