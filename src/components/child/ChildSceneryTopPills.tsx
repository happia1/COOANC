'use client'

import Image from 'next/image'
import { useState } from 'react'

/**
 * 홈·미션 등 풍경 배경 상단에 붙는 UI 묶음입니다.
 * - 연속 일수·크레딧 같은 알약(StatPill)
 * - 성장 지도를 여는 지도 단추(MapActionPill)
 * - 스티커 보관함을 여는 스티커 단추(StickerActionPill)
 * 지도·스티커 단추는 흰 배경 없이 아이콘만 보이게 했습니다(연속·크레딧 알약과 구분).
 */

/** 성장 지도(뱃지 시트)를 열 때 누르는 단추 — 공용 UI 이미지 map.png, 배경 없이 아이콘만 / 실패 시 SVG */
export function MapActionPill({ onClick }: { onClick: () => void }) {
  const [mapImgOk, setMapImgOk] = useState(true)

  /** 아이콘을 키운 만큼 `p-1.5` 로 탭하기 좋은 영역을 유지합니다. */
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center justify-center rounded-md bg-transparent p-1.5 shadow-none transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/35"
      aria-label="성장 지도와 뱃지 열기"
    >
      {mapImgOk ? (
        <Image
          src="/assets/img/common/ui/map.png"
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 object-contain sm:h-10 sm:w-10"
          onError={() => setMapImgOk(false)}
        />
      ) : (
        <svg className="h-9 w-9 text-emerald-600 sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="none" aria-hidden>
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
      )}
    </button>
  )
}

/**
 * 곰돌이 스티커 판·보관함을 열 때 누르는 단추입니다.
 * - 기본: sticker_icon.png(배경 없이 아이콘만)
 * - `useCustomImage`가 꺼지거나 이미지 오류 시 말풍선 SVG
 */
export function StickerActionPill({
  onClick,
  useCustomImage,
  onImageError,
}: {
  onClick: () => void
  useCustomImage: boolean
  onImageError: () => void
}) {
  /** 지도 단추와 동일한 크기·패딩으로 화면에서 짝을 맞춥니다. */
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex shrink-0 items-center justify-center rounded-md bg-transparent p-1.5 shadow-none transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/35"
      aria-label="스티커 보관함과 곰돌이 판 열기"
    >
      {useCustomImage ? (
        <Image
          src="/assets/img/common/ui/sticker_icon.png"
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 object-contain sm:h-10 sm:w-10"
          onError={onImageError}
        />
      ) : (
        <svg className="h-9 w-9 text-brand-blue sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="none" aria-hidden>
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
