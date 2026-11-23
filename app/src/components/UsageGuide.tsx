interface Step {
  title: string
  desc: string
}

const STEPS: Step[] = [
  { title: 'MIDI 파일 첨부', desc: '파일을 끌어다 놓거나 [파일 선택]을 누릅니다. 여러 파일도 한 번에 됩니다.' },
  { title: '변환 방식 선택', desc: '모든 악기를 피아노 한 대로 합치거나, 악기마다 따로 악보를 만듭니다.' },
  { title: '[악보 만들기]', desc: '파일 카드의 버튼을 누르면 아래에 악보가 나타납니다.' },
  { title: '확인하고 저장', desc: '악보를 확대·축소해 보고 PDF 또는 MusicXML로 저장합니다.' },
  { title: 'Finale에서 열기', desc: 'PC의 Finale에서 MusicXML을 열고 다른 이름으로 저장하면 .musx가 됩니다.' },
]

/** 사용 방법 안내. current는 지금 해야 할 단계(1~5)이고 그 앞 단계는 완료로 표시한다. */
export default function UsageGuide({ current }: { current: 1 | 2 | 4 }) {
  return (
    <details open className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5" data-testid="usage-guide">
      <summary className="cursor-pointer text-base font-semibold">사용 방법</summary>
      <ol className="mt-4 grid gap-3 sm:grid-cols-5">
        {STEPS.map((s, i) => {
          const no = i + 1
          const done = no < current
          const active = no === current
          return (
            <li
              key={s.title}
              data-testid="usage-step"
              data-state={done ? 'done' : active ? 'active' : 'todo'}
              className={`rounded-lg border p-3 text-sm ${
                active ? 'border-sky-500 bg-sky-950' : done ? 'border-emerald-900 bg-emerald-950/60' : 'border-slate-800 bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done ? 'bg-emerald-700 text-white' : active ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                  aria-hidden="true"
                >
                  {done ? '✓' : no}
                </span>
                <span className="font-medium">{s.title}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{s.desc}</p>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs text-slate-400">
        MIDI가 없을 때 쓰는 음원(mp3, wav) 분석은 준비 중입니다. 폰·태블릿에서도 1~4단계를 쓸 수 있고, Finale는 PC에서만 열 수 있어 파일을 PC로 옮겨야 합니다.
      </p>
    </details>
  )
}
