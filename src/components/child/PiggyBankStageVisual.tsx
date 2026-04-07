'use client'

import Image from 'next/image'
import SpriteImage from '@/components/common/SpriteImage'
import {
  PIGGY_BANK_ATLAS_SIZE,
  PIGGY_BANK_COMBINED_SRC,
  GOLD_PIGGY_BANK_FRAMES,
  PIGGY_BANK_STAGE_FRAME_ORDER,
  PIGGY_BANK_STAGE_RECTS,
  PIGGY_BANK_STAGE_URLS,
  piggyBankStageCount,
} from '@/constants/piggyBankStages'

type Props = {
  /** 0 .. (단계 수 - 1) */
  stepIndex: number
  /** 표시 가로 너비(px). 세로는 비율에 맞춤 */
  displayWidth: number
  className?: string
}

/**
 * 저금통 단계 그림: (1) 개별 PNG URL 목록이 있으면 그걸 쓰고,
 * (2) 없으면 합성 PNG + 픽셀 사각형으로 잘라 보여 주며,
 * (3) 둘 다 없으면 합성 PNG 전체를 상자 안에 맞춥니다.
 */
export default function PiggyBankStageVisual({ stepIndex, displayWidth, className }: Props) {
  const n = piggyBankStageCount()
  const idx = Math.max(0, Math.min(stepIndex, n - 1))

  const urls = PIGGY_BANK_STAGE_URLS
  if (urls != null && urls.length > 0) {
    const src = urls[idx] ?? urls[0]
    return (
      <Image
        src={src}
        alt=""
        width={displayWidth}
        height={displayWidth}
        className={['h-auto w-full max-w-none select-none object-contain', className].filter(Boolean).join(' ')}
        style={{ width: displayWidth, height: 'auto' }}
        draggable={false}
      />
    )
  }

  const rects = PIGGY_BANK_STAGE_RECTS
  const frameOrder = PIGGY_BANK_STAGE_FRAME_ORDER

  if (frameOrder.length > 0) {
    const frameName = frameOrder[idx] ?? frameOrder[0]
    const spriteFrames = Object.fromEntries(
      GOLD_PIGGY_BANK_FRAMES.map((f) => [
        f.name,
        { x: f.x, y: f.y, w: f.w, h: f.h, rotated: f.rotated },
      ]),
    )
    return (
      <SpriteImage
        sheet={{
          image: PIGGY_BANK_COMBINED_SRC.replace('/assets/img/', ''),
          atlasW: PIGGY_BANK_ATLAS_SIZE.w,
          atlasH: PIGGY_BANK_ATLAS_SIZE.h,
          frames: spriteFrames,
        }}
        frame={frameName}
        width={displayWidth}
        clipRotated={false}
        className={['select-none object-contain', className].filter(Boolean).join(' ')}
      />
    )
  }

  if (rects.length > 0) {
    const r = rects[idx] ?? rects[0]
    const scale = displayWidth / r.w
    const boxH = Math.max(1, Math.round(r.h * scale))
    const { w: aw, h: ah } = PIGGY_BANK_ATLAS_SIZE
    return (
      <div
        aria-hidden
        className={['shrink-0 bg-no-repeat', className].filter(Boolean).join(' ')}
        style={{
          width: displayWidth,
          height: boxH,
          backgroundImage: `url(${PIGGY_BANK_COMBINED_SRC})`,
          backgroundSize: `${aw * scale}px ${ah * scale}px`,
          backgroundPosition: `-${r.x * scale}px -${r.y * scale}px`,
        }}
      />
    )
  }

  /** 단계 정보가 없을 때: 한 장 전체를 상자에 넣음(합성 썸네일처럼 보일 수 있음) */
  return (
    <Image
      src={PIGGY_BANK_COMBINED_SRC}
      alt=""
      width={displayWidth}
      height={displayWidth}
      className={['h-auto w-full max-w-none select-none object-contain', className].filter(Boolean).join(' ')}
      style={{ width: displayWidth, height: 'auto' }}
      draggable={false}
    />
  )
}
