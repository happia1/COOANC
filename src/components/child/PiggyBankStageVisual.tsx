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
  piggyAtlasVisualSize,
  piggyBankStageCount,
  type PiggyAtlasFrame,
} from '@/constants/piggyBankStages'

type Props = {
  /** 0 .. (단계 수 - 1) */
  stepIndex: number
  /** 표시 가로 너비(px). 세로는 비율에 맞춤 — 단계가 올라갈수록 내부에서 추가로 키웁니다. */
  displayWidth: number
  className?: string
}

/** 핑크 돼지(336) 기준 아틀라스 가로 — 340~ 단계 bbox 가 넓을 때 작아 보이지 않게 보정할 때 사용 */
function refPinkPigAtlasW(frames: ReadonlyArray<PiggyAtlasFrame>): number {
  const f = frames.find((x) => x.name === '레이어 336')
  return f ? piggyAtlasVisualSize(f).vw : 195
}

/**
 * 저금통 단계가 높아질수록 그림도 함께 커 보이게 하는 배율.
 * - 첫 단계(핑크 돼지)는 예전 0.66 배율 때문에 미션 섬 **지갑 아이콘(56px)** 보다 훨씬 작아 보였음 → 시작을 ~0.98 로 두어 지갑과 비슷한 체감 크기로 맞춤.
 * - 마지막 단계는 조금 더 키워 성장감 유지.
 */
function piggyStageProgressScale(stepIndex: number, stageCount: number): number {
  if (stageCount <= 1) return 1
  const p = stepIndex / (stageCount - 1)
  const min = 0.98
  const max = 1.3
  return min + p * (max - min)
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
  const rects = PIGGY_BANK_STAGE_RECTS
  const frameOrder = PIGGY_BANK_STAGE_FRAME_ORDER
  const refPinkW = refPinkPigAtlasW(GOLD_PIGGY_BANK_FRAMES)
  const stageMul = piggyStageProgressScale(idx, n)

  if (urls != null && urls.length > 0) {
    const w = Math.round(displayWidth * stageMul)
    const src = urls[idx] ?? urls[0]
    return (
      <div
        className={[
          'inline-flex max-w-none items-end justify-center overflow-visible px-0.5 pb-2.5 pt-0.5',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Image
          src={src}
          alt=""
          width={w}
          height={w}
          className="h-auto w-full max-w-none select-none object-contain"
          style={{ width: w, height: 'auto' }}
          draggable={false}
        />
      </div>
    )
  }

  if (frameOrder.length > 0) {
    const atlasFrame = GOLD_PIGGY_BANK_FRAMES[idx]
    const frameName = atlasFrame?.name ?? frameOrder[idx] ?? frameOrder[0]
    const vw = atlasFrame ? piggyAtlasVisualSize(atlasFrame).vw : refPinkW

    /** 336 은 1.0 유지 — 0.9 는 세로 여백만 줄어들어 엉덩이·다리가 잘린 것처럼 보일 수 있음 */
    const OPTICAL_SCALE_BY_FRAME: Record<string, number> = {
      '레이어 336': 1,
      '레이어 337': 1.06,
      '레이어 338': 1.03,
      '레이어 339': 1.02,
    }
    const manual = OPTICAL_SCALE_BY_FRAME[frameName] ?? 1
    const lateStageBoost = idx >= 4 && vw > refPinkW ? vw / refPinkW : 1
    const normalizedWidth = Math.round(displayWidth * manual * lateStageBoost * stageMul)

    const spriteFrames = Object.fromEntries(
      GOLD_PIGGY_BANK_FRAMES.map((f) => [
        f.name,
        { x: f.x, y: f.y, w: f.w, h: f.h, rotated: f.rotated },
      ]),
    )
    /**
     * 그림자(`filter`)·회전 스프라이트는 바깥 박스에 딱 맞추면 아래가 잘려 보일 수 있어,
     * `filter`·여백은 바깥 래퍼에 두고 안쪽은 `overflow-visible` 만 유지합니다.
     */
    return (
      <div
        className={[
          'inline-flex max-w-none items-end justify-center overflow-visible px-0.5 pb-2.5 pt-0.5',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <SpriteImage
          sheet={{
            image: PIGGY_BANK_COMBINED_SRC.replace('/assets/img/', ''),
            atlasW: PIGGY_BANK_ATLAS_SIZE.w,
            atlasH: PIGGY_BANK_ATLAS_SIZE.h,
            frames: spriteFrames,
          }}
          frame={frameName}
          width={normalizedWidth}
          clipRotated={false}
          className="select-none object-contain"
        />
      </div>
    )
  }

  if (rects.length > 0) {
    const r = rects[idx] ?? rects[0]
    const w0 = displayWidth * stageMul
    const scale = w0 / r.w
    const boxH = Math.max(1, Math.round(r.h * scale))
    const { w: aw, h: ah } = PIGGY_BANK_ATLAS_SIZE
    return (
      <div
        className={[
          'inline-flex max-w-none items-end justify-center overflow-visible px-0.5 pb-2.5 pt-0.5',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          aria-hidden
          className="shrink-0 bg-no-repeat"
          style={{
            width: Math.round(w0),
            height: boxH,
            backgroundImage: `url(${PIGGY_BANK_COMBINED_SRC})`,
            backgroundSize: `${aw * scale}px ${ah * scale}px`,
            backgroundPosition: `-${r.x * scale}px -${r.y * scale}px`,
          }}
        />
      </div>
    )
  }

  const wFallback = Math.round(displayWidth * stageMul)
  return (
    <div
      className={[
        'inline-flex max-w-none items-end justify-center overflow-visible px-0.5 pb-2.5 pt-0.5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Image
        src={PIGGY_BANK_COMBINED_SRC}
        alt=""
        width={wFallback}
        height={wFallback}
        className="h-auto w-full max-w-none select-none object-contain"
        style={{ width: wFallback, height: 'auto' }}
        draggable={false}
      />
    </div>
  )
}
