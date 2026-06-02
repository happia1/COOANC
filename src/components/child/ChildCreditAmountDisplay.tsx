'use client'

/**
 * 레벨 블록과 동일한 크레딧 아이콘 + 숫자 한 줄
 *
 * 비개발자 설명:
 * - 왼쪽 위 레벨 카드에 보이는 동전 그림·숫자 크기/색을 그대로 복사해 씁니다.
 */

import { CHILD_CREDIT_COIN_PNG_SRC, formatChildCreditsDisplay } from '@/lib/childCreditDisplay'

type Props = {
  value: number
  /** ref — 저금통에서 동전이 날아가는 출발점 */
  innerRef?: React.RefObject<HTMLDivElement | null>
  className?: string
  /** 레벨 카드와 같게 20px, 팝업에서는 더 크게 쓸 수 있음 */
  fontSizePx?: number
  /** 숫자 앞 아이콘 — 기본은 크레딧 동전 */
  iconSrc?: string
}

export default function ChildCreditAmountDisplay({
  value,
  innerRef,
  className = '',
  fontSizePx = 20,
  iconSrc = CHILD_CREDIT_COIN_PNG_SRC,
}: Props) {
  return (
    <div ref={innerRef} className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={iconSrc}
        alt=""
        width={18}
        height={18}
        className="h-[18px] w-[18px] shrink-0 object-contain select-none"
        draggable={false}
      />
      <span
        className="min-w-0 truncate font-black tabular-nums leading-none"
        style={{
          fontSize: fontSizePx,
          color: '#7A4F00',
          letterSpacing: '-0.5px',
        }}
      >
        {formatChildCreditsDisplay(value)}
      </span>
    </div>
  )
}
