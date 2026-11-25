import { t } from '../text'

/** 기획서 11.1장: 항상 표시하는 안내 문구 */
export default function Notices() {
  return (
    <ul
      className="space-y-1.5 rounded-lg border border-sky-800 bg-sky-950 px-4 py-3 text-sm text-sky-100"
      data-testid="notices"
    >
      {t.notices.map((text, i) => (
        <li key={i} className="flex gap-2" data-testid="notice">
          <span aria-hidden="true" className="text-sky-400">
            ●
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}
