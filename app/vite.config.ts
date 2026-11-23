import fs from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// 변경 이력(src/changelog.ts)의 맨 위 버전과 package.json 버전이 같아야 한다.
// 기능을 추가하거나 화면을 바꾸고 버전 갱신을 잊으면 빌드·개발 서버가 멈춰 알려 준다.
const changelogSrc = fs.readFileSync(new URL('./src/changelog.ts', import.meta.url), 'utf8')
const latest = /version:\s*'(\d+\.\d+\.\d+)'/.exec(changelogSrc)?.[1]
if (latest !== pkg.version) {
  throw new Error(
    `버전 불일치: package.json은 ${pkg.version}, src/changelog.ts 맨 위 항목은 ${latest ?? '없음'}입니다. 두 곳을 같은 값으로 맞춰 주세요.`,
  )
}

/** index.html의 __APP_VERSION__을 버전으로 바꾼다 (브라우저 탭 제목용) */
function htmlVersion(): Plugin {
  return { name: 'html-version', transformIndexHtml: (html) => html.replaceAll('__APP_VERSION__', pkg.version) }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), htmlVersion()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
