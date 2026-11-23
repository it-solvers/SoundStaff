import { COLAB_URL } from '../config'
import { t } from '../text/ko'

/** [고품질 변환(Colab) 열기] 버튼. 주소가 아직 없으면 비활성 "준비 중"으로 보인다. */
export default function ColabLink({ url = COLAB_URL }: { url?: string }) {
  const base = 'inline-block rounded-lg px-3 py-1.5 text-sm font-medium'
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="colab">
      <span className="text-xs text-slate-300">{t.colab.question}</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
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
