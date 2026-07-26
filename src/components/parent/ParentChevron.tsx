/**
 * 부모 앱 공용 화살표(셰브론).
 *
 * 비개발자 설명:
 * - 이전까지는 화면마다 화살표가 제각각이었습니다.
 *   캐릭터 블록은 「‹ ›」 글자, 캘린더는 같은 글자인데 더 크고, 메뉴 제어는 「▼」 글자,
 *   루틴 탭만 그림(SVG)이라 굵기·크기·모양이 전부 달라 보였습니다.
 * - 이제 부모 앱의 모든 화살표는 이 컴포넌트 하나를 씁니다.
 *   여기 굵기·크기를 고치면 앱 전체가 같이 바뀝니다.
 *
 * 쓰는 법:
 *   <ParentChevron direction="left" size="lg" />   // 이전 달·이전 자녀
 *   <ParentChevron direction="right" />            // 자세히 보기(›)
 *   <ParentChevron open={펼침여부} />               // 접기·펼치기 토글(아래 ↔ 위)
 */

export type ParentChevronDirection = 'up' | 'down' | 'left' | 'right'
export type ParentChevronSize = 'sm' | 'md' | 'lg'

/** 화살표 크기 — 목록 안 작은 표시(sm) / 기본(md) / 달·자녀 넘기기(lg) */
const SIZE_CLASS: Record<ParentChevronSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

/**
 * 기본 그림은 「아래」를 가리킵니다. 나머지 방향은 돌려서 씁니다.
 * 클래스가 아니라 각도로 두는 이유: `open` 토글과 겹칠 때
 * rotate 클래스 두 개가 충돌해 어느 쪽이 이길지 보장되지 않기 때문입니다.
 */
const ROTATE_DEG: Record<ParentChevronDirection, number> = {
  down: 0,
  up: 180,
  left: 90,
  right: -90,
}

type Props = {
  /** 가리킬 방향 — 기본은 아래 */
  direction?: ParentChevronDirection
  size?: ParentChevronSize
  /**
   * 접기·펼치기 토글에서 씁니다. `true` 면 방향이 반대로 뒤집힙니다.
   * (예: direction 생략 + open={true} → 위쪽 화살표)
   */
  open?: boolean
  className?: string
}

export default function ParentChevron({
  direction = 'down',
  size = 'md',
  open,
  className = '',
}: Props) {
  /** 토글로 쓸 때는 펼침 상태에서 180도 더 돌립니다 */
  const deg = ROTATE_DEG[direction] + (open === true ? 180 : 0)

  return (
    <svg
      className={`${SIZE_CLASS[size]} shrink-0 transition-transform duration-200 ${className}`}
      style={{ transform: `rotate(${deg}deg)` }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
