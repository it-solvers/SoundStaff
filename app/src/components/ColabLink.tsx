import { COLAB_URL } from '../config'
import { COLAB_OPENED_EVENT, openColabWindow, type ColabOpenedDetail } from '../colabWindow'
import { t } from '../text/ko'

/** [고품질 변환(Colab) 열기] 버튼. 주소가 아직 없으면 비활성 "준비 중"으로 보인다. */
export default function ColabLink({ url = COLAB_URL, onOpen }: { url?: string; onOpen?: () => void }) {
  const base = 'inline-block rounded-lg px-3 py-1.5 text-sm font-medium'
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="colab">
      <span className="text-xs text-slate-300">{t.colab.question}</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            onOpen?.()
            // 작은 창(팝업)으로 열어 이 화면이 옆에 그대로 보이게 한다. 팝업이 막히면 링크 기본 동작(새 탭)으로 넘어간다.
            const win = openColabWindow(url)
            if (win) e.preventDefault()
            window.dispatchEvent(new CustomEvent<ColabOpenedDetail>(COLAB_OPENED_EVENT, { detail: { win } }))
          }}
          className={`${base} bg-amber-600 text-white hover:bg-amber-500`}
          data-testid="colab-link"
        >
          {t.colab.open}
        </a>
      ) : (
        <span
          className={`${base} cursor-not-allowed bg-slate-800 text-slate-500`}
          aria-disabled="true"
          data-testid="colab-link-pending"
        >
          {t.colab.open} · {t.colab.pending}
        </span>
      )}
    </span>
  )
}
