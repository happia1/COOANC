'use client'

import Image from 'next/image'

/** 홈·미션 등 풍경 배경 상단 — 연속·크레딧 알약 + 지도·스티커 단추 (동일 스타일) */

export function MapActionPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center justify-center rounded-full bg-white/80 px-3.5 py-1.5 shadow-sm transition active:scale-95"
      aria-label="성장 지도와 뱃지 열기"
    >
      <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 16.5 9 13l4 3 7-5v9H4v-5.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M9 13V5l4 2.5V16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M20 11V4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  )
}

export function StickerActionPill({
  onClick,
  useCustomImage,
  onImageError,
}: {
  onClick: () => void
  useCustomImage: boolean
  onImageError: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/80 px-3.5 py-1.5 shadow-sm transition active:scale-95"
      aria-label="스티커 보관함과 곰돌이 판 열기"
    >
      {useCustomImage ? (
        <Image
          src="/assets/img/items/shop/sticker_fab_icon.png"
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 object-cover"
          onError={onImageError}
        />
      ) : (
        <svg className="h-5 w-5 text-brand-blue" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 4.5h10.5a2.5 2.5 0 0 1 2.5 2.5v6a2 2 0 0 1-2 2H9l-3.5 3v-3H5a2 2 0 0 1-2-2v-6a2.5 2.5 0 0 1 2.5-2.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="8.2" cy="9.5" r="0.85" fill="currentColor" />
          <circle cx="10.8" cy="9.5" r="0.85" fill="currentColor" />
          <path
            d="M7.2 12.2c.6.9 1.4 1.4 2.3 1.4s1.7-.5 2.3-1.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}

export function StatPill({
  label,
  value,
  highlight = false,
  className = '',
}: {
  label: string
  value: string
  highlight?: boolean
  className?: string
}) {
  return (
    <div
      className={[
        'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 shadow-sm',
        highlight ? 'bg-brand-yellow/30 ring-1 ring-brand-yellow' : 'bg-white/80',
        className,
      ].join(' ')}
    >
      <span className="text-[10px] font-bold text-gray-500">{label}</span>
      <span className="text-sm font-bold tabular-nums text-brand-text">{value}</span>
    </div>
  )
}
