import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
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
  // 파일 경로를 상대 경로로 만들어, 어느 주소(루트든 하위 폴더든)에 올려도 동작하게 한다 (배포 위치는 작성자가 정한다)
  base: './',
  plugins: [react(), tailwindcss(), htmlVersion()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // 음원 분석 작업 스레드(Web Worker)를 모듈 형식으로 묶는다 (AI 라이브러리를 가져오기 위해)
  worker: { format: 'es' },
  build: {
    // 악보 그리기(OSMD)·PDF 만들기 묶음은 원래 크고, 해당 기능을 쓸 때만 내려받으므로 경고 기준을 넉넉히 둔다
    chunkSizeWarningLimit: 2000,
    // 한국어(/)와 영어(/en/) 페이지. 화면 코드는 같고 <html lang>에 따라 문구만 달라진다.
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        en: fileURLToPath(new URL('./en/index.html', import.meta.url)),
      },
    },
  },
})
