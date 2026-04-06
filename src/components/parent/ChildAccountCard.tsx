type Props = {
  /** 자녀 profiles.id (UUID 문자열) */
  childId: string
  name: string
  level: number
  streakDays: number
  credits: number
}

/**
 * 부모 홈에서 자녀 한 명을 나타내는 카드입니다.
 * - 누르면 자녀용 앱(/home)으로 들어가도록 enter-child-ui API 로 연결합니다.
 * - `<a href>` 로 두어 브라우저 기본 이동을 씁니다.
 */
export function ChildAccountCard({ childId, name, level, streakDays, credits }: Props) {
  const href = `/api/parent/enter-child-ui?childId=${encodeURIComponent(childId)}`

  return (
    <a
      href={href}
      className="flex w-full min-h-[56px] cursor-pointer items-center justify-between rounded-3xl bg-white px-5 py-4 shadow-md transition hover:shadow-lg active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-blue/30 touch-manipulation no-underline text-inherit"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-black text-sky-700"
          aria-hidden
        >
          {name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-brand-text">{name}</p>
          <p className="text-xs text-gray-400">
            Lv.{level} · 연속 {streakDays}일
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right pl-2">
        <p className="text-lg font-black text-brand-blue">{credits}</p>
        <p className="text-[11px] text-gray-400">크레딧</p>
      </div>
    </a>
  )
}
