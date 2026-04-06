'use client'

import {
  PRAISE_UI_ICON_SHEET,
  PRAISE_UI_FRAME,
  PRAISE_UI_SHEET_H,
  PRAISE_UI_SHEET_W,
  type PraiseUiKind,
} from '@/lib/praiseStickerUi'

type Props = {
  kind: PraiseUiKind
  /** 한 변 길이(px) — 정사각 셀에 맞춤 */
  size?: number
  className?: string
  label?: string
  /** true면 배경·둥근 테두리 없이 스프라이트만(곰돌이 판 종이 위 등) */
  plain?: boolean
}

/**
 * icons.png 스프라이트에서 TexturePacker frame 한 칸만 보여 줍니다.
 * 바깥 정사각형 안에 아이콘이 비율 유지로 들어가도록(잘리지 않음) 스케일을 맞춥니다.
 */
export default function PraiseUiIcon({ kind, size = 56, className = '', label, plain = false }: Props) {
  const frame = PRAISE_UI_FRAME[kind]
  // 프레임 전체가 size×size 안에 들어가게 하는 배율(긴 변 기준)
  const scale = Math.min(size / frame.w, size / frame.h)
  const imgW = PRAISE_UI_SHEET_W * scale
  const imgH = PRAISE_UI_SHEET_H * scale
  const clipW = frame.w * scale
  const clipH = frame.h * scale
  const left = -frame.x * scale
  const top = -frame.y * scale

  return (
    <div
      className={
        plain
          ? `relative flex shrink-0 items-center justify-center ${className}`
          : `relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/40 ${className}`
      }
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {/* 보이는 영역은 프레임 크기만큼만 — 나머지는 잘림 */}
      <div className="relative overflow-hidden" style={{ width: clipW, height: clipH }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PRAISE_UI_ICON_SHEET}
          alt=""
          width={imgW}
          height={imgH}
          className="pointer-events-none max-w-none select-none"
          style={{ position: 'absolute', left, top, width: imgW, height: imgH }}
          draggable={false}
        />
      </div>
    </div>
  )
}
