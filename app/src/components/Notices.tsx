/** 기획서 11.1장: 화면 안내 문구 3종 (항상 표시) */
const NOTICES = [
  '자동 변환 결과이며 정확하지 않을 수 있습니다. 악보 편집 프로그램에서 수정하세요.',
  '사용 권한이 있는 파일만 사용하세요. 무료 요금제로 만든 곡은 비상업적 용도로만 쓸 수 있는 경우가 있습니다.',
  '파일은 서버로 전송되지 않고 이 기기에서만 처리됩니다.',
]

export default function Notices() {
  return (
    <ul className="space-y-1.5 rounded-lg border border-sky-800 bg-sky-950 px-4 py-3 text-sm text-sky-100" data-testid="notices">
      {NOTICES.map((text, i) => (
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
