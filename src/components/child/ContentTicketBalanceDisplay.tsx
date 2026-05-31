import {
  CONTENT_MINIGAME_TICKET_IMAGE_URL,
  CONTENT_VIDEO_TICKET_IMAGE_URL,
  type ChildContentMenuItemId,
} from '@/constants/childContentMenu'

type TicketKind = ChildContentMenuItemId

const TICKET_META: Record<TicketKind, { imageUrl: string; label: string }> = {
  video: {
    imageUrl: CONTENT_VIDEO_TICKET_IMAGE_URL,
    label: '영상 시청권',
  },
  minigame: {
    imageUrl: CONTENT_MINIGAME_TICKET_IMAGE_URL,
    label: '미니게임 이용권',
  },
}

type ChipProps = {
  kind: TicketKind
  quantity: number
  /** sm: 메뉴 카드 · md: 큰 표시 */
  size?: 'sm' | 'md'
  /** true 이면 이용권 아이콘 없이 숫자만 (메뉴 카드용) */
  numbersOnly?: boolean
  /** true 이면 스크린 리더에서 숨김 (위에 준비 중 오버레이가 있을 때) */
  ariaHidden?: boolean
}

/** 이용권 1종 — 보유 개수 (옵션: 아이콘 + 숫자) */
export function ContentTicketCountChip({
  kind,
  quantity,
  size = 'md',
  numbersOnly = false,
  ariaHidden = false,
}: ChipProps) {
  const meta = TICKET_META[kind]
  const iconBox = size === 'sm' ? 'h-8 w-8 p-0.5' : 'h-10 w-10 p-1'
  const countClass = size === 'sm' ? 'text-base' : 'text-xl'

  if (numbersOnly) {
    return (
      <span
        className={`font-black tabular-nums leading-none text-gray-800 ${countClass}`}
        aria-label={ariaHidden ? undefined : `${meta.label} ${quantity}개`}
        aria-hidden={ariaHidden || undefined}
      >
        {quantity > 99 ? '99+' : quantity}
      </span>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`${meta.label} ${quantity}개`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-white ${iconBox}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meta.imageUrl}
          alt=""
          className="h-full w-full object-contain"
          draggable={false}
        />
      </span>
      <span className={`font-black tabular-nums leading-none text-gray-800 ${countClass}`}>
        {quantity > 99 ? '99+' : quantity}
      </span>
    </div>
  )
}

type VideoWatchBalanceRowProps = {
  ticketQuantity: number
  watchTimeLabel: string
  size?: 'sm' | 'md'
}

/** 영상 시청권 — 아이콘·장수·시청 가능 시간을 한 줄에 표시 */
export function ContentVideoWatchBalanceRow({
  ticketQuantity,
  watchTimeLabel,
  size = 'sm',
}: VideoWatchBalanceRowProps) {
  const meta = TICKET_META.video
  const iconBox = size === 'sm' ? 'h-8 w-8 p-0.5' : 'h-10 w-10 p-1'
  const countClass = size === 'sm' ? 'text-base' : 'text-xl'
  const timeClass = size === 'sm' ? 'text-[12px]' : 'text-sm'
  const qty = ticketQuantity > 99 ? '99+' : ticketQuantity

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
      aria-label={`${meta.label} ${qty}장, 시청 가능 시간 ${watchTimeLabel}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`flex shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-white ${iconBox}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meta.imageUrl}
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
          />
        </span>
        <span className={`font-black tabular-nums leading-none text-gray-800 ${countClass}`}>
          {qty}
        </span>
      </span>
      <span className="text-[11px] font-bold text-gray-300" aria-hidden>
        ·
      </span>
      <span className={`font-bold text-gray-600 ${timeClass}`}>
        시청 가능 시간{' '}
        <span className="font-black tabular-nums text-indigo-600">{watchTimeLabel}</span>
      </span>
    </div>
  )
}

type BalanceProps = {
  videoQuantity: number
  minigameQuantity: number
  size?: 'sm' | 'md'
}

/** 영상·미니게임 이용권 보유 수 (아이콘 + 숫자) */
export default function ContentTicketBalanceDisplay({
  videoQuantity,
  minigameQuantity,
  size = 'md',
}: BalanceProps) {
  return (
    <div className="flex items-center justify-center gap-5">
      <ContentTicketCountChip kind="video" quantity={videoQuantity} size={size} />
      <ContentTicketCountChip kind="minigame" quantity={minigameQuantity} size={size} />
    </div>
  )
}
