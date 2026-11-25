import { useEffect, useState } from 'react'
import { t } from '../text'
import { APP_VERSION } from '../version'
import LanguageLink from './LanguageLink'
import StepBar from './StepBar'
import ThemeToggle from './ThemeToggle'

/** 이만큼 넘게 내리면 접고, 거의 맨 위로 돌아오면 다시 편다 (경계에서 접혔다 펴졌다 하지 않게 두 값이 다르다) */
const COLLAPSE_AT = 24
const EXPAND_AT = 4

/** 같은 시간·곡선으로 움직여야 접히는 높이와 아래 빈칸이 늘 상쇄된다 */
const MOTION = 'duration-300 ease-out motion-reduce:transition-none'

/**
 * Sticky header: 맨 위에서는 큰 제목과 단계 설명까지 보이고(아래의 소개·알림과 한 덩어리로 보인다),
 * 스크롤하면 얇게 접히며 그림자가 생긴다.
 * 접히며 줄어든 높이(36px = 제목 줄 16px + 설명 줄 20px)만큼 바로 아래의 빈칸을 늘려, 본문은 움직이지 않는다.
 */
export default function TopBar({ step, showSteps }: { step: 1 | 2 | 3 | 4; showSteps: boolean }) {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const onScroll = () => setCompact((now) => window.scrollY > (now ? EXPAND_AT : COLLAPSE_AT))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={`sticky top-0 z-30 bg-slate-950 transition-shadow ${MOTION} ${
          compact ? 'shadow-lg shadow-black/25' : 'shadow-none'
        }`}
        data-testid="top-bar"
        data-compact={compact ? 'true' : 'false'}
      >
        <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6">
          <div
            className={`flex items-center justify-between gap-2 transition-[height] ${MOTION} ${compact ? 'h-10' : 'h-14'}`}
          >
            <h1
              className={`font-semibold tracking-tight whitespace-nowrap transition-[font-size] ${MOTION} ${
                compact ? 'text-lg' : 'text-xl sm:text-4xl'
              }`}
            >
              {t.appName} {/* 아주 좁은 폰에서는 언어·화면 색 버튼과 한 줄에 들어가도록 버전을 감춘다 */}
              <span
                className={`font-normal text-slate-400 transition-[font-size] max-[359px]:hidden ${MOTION} ${
                  compact ? 'text-sm' : 'text-sm sm:text-[27px]'
                }`}
                data-testid="app-version"
              >
                ({APP_VERSION})
              </span>
            </h1>
            <div className="flex items-center gap-1 sm:gap-3">
              <LanguageLink />
              <ThemeToggle />
            </div>
          </div>
          {showSteps && <StepBar current={step} compact={compact} />}
        </div>
      </header>
      <div
        aria-hidden="true"
        className={`shrink-0 transition-[height] ${MOTION} ${compact ? (showSteps ? 'h-9' : 'h-4') : 'h-0'}`}
      />
    </>
  )
}
