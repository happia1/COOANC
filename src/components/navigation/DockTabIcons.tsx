/**
 * 부모·자녀 하단 독바에서 같이 쓰는 탭 아이콘(SVG) 모음입니다.
 * - 집: 홈 탭
 * - 스마일: 미션(또는 부모 쪽 루틴) 탭 느낌
 * - 가게: 마켓 탭
 */
export type DockTabIconId = 'home' | 'smile' | 'market'

/** 집 모양: 지붕 + 몸통, 가운데 문은 비움 */
export function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 5 11.2 L 12 4.6 L 19 11.2 V 20 H 5 Z M 10.2 14.6 H 13.8 V 20 H 10.2 Z"
      />
    </svg>
  )
}

/** 원 + 눈 두 점 + 웃는 입 (미션 탭 스타일) */
export function IconSmile({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" />
      <path
        d="M8.2 14.2c.9 1.6 2.5 2.6 3.8 2.6s2.9-1 3.8-2.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 가게: 윗막대 + 물결 차양 + 아래 몸통 */
export function IconMarket({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="5" y="5" width="14" height="2.2" rx="0.55" />
      <path d="M 5 8.2 H 19 V 9.4 L 17.4 11.6 H 15.9 L 14.4 9.4 L 12.9 11.6 H 11.4 L 9.9 9.4 L 8.4 11.6 H 6.9 L 5.4 9.4 V 8.2 Z" />
      <rect x="6.2" y="12.4" width="11.6" height="8.4" rx="0.9" />
    </svg>
  )
}

/** 독바에서 icon id 로 위 세 가지 중 하나를 그립니다 */
export function DockTabIcon({ id, className }: { id: DockTabIconId; className?: string }) {
  if (id === 'home') return <IconHome className={className} />
  if (id === 'smile') return <IconSmile className={className} />
  return <IconMarket className={className} />
}
