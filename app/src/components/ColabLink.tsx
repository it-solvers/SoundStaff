import { COLAB_URL } from '../config'
import { t } from '../text/ko'

/** 어느 Colab 링크를 눌러도 안내판이 "Colab에 다녀오는 중"임을 알 수 있게 하는 신호 */
export const COLAB_OPENED_EVENT = 'soundstaff:colab-opened'

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
          onClick={() => {
            onOpen?.()
            window.dispatchEvent(new Event(COLAB_OPENED_EVENT))
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
