import { t } from '../text'

/** 다른 언어 페이지로 가는 링크. 새 페이지를 여는 것이라 첨부한 파일은 다시 올려야 한다. */
export default function LanguageLink() {
  return (
    <a
      href={t.language.href}
      hrefLang={t.language.lang}
      lang={t.language.lang}
      className="inline-flex min-h-8 items-center px-1 text-xs text-slate-300 underline hover:text-slate-100"
      data-testid="language-link"
    >
      {t.language.label}
    </a>
  )
}
