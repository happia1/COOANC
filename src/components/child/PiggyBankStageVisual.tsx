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
    /**
     * 실제로 "보이는 돼지 본체" 크기가 단계마다 비슷하게 보이도록 광학 보정 배율을 적용합니다.
     * - 특히 0단계(레이어 336)가 크게, 1단계(레이어 337)가 작게 보이던 체감 차이를 우선 보정합니다.
     * - 숫자는 UI에서 본체 시각 크기를 기준으로 맞춘 값이며, 필요 시 단계별로 더 미세 조정 가능합니다.
     */
    const OPTICAL_SCALE_BY_FRAME: Record<string, number> = {
      '레이어 336': 0.9,
      '레이어 337': 1.06,
      '레이어 338': 1.03,
      '레이어 339': 1.02,
    }
    const opticalScale = OPTICAL_SCALE_BY_FRAME[frameName] ?? 1
    const normalizedWidth = Math.round(displayWidth * opticalScale)
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
        width={normalizedWidth}
        /** 전환 중 다른 프레임이 스쳐 보이는 현상을 막기 위해 회전 프레임도 내부에서 클립합니다. */
        clipRotated={true}
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
