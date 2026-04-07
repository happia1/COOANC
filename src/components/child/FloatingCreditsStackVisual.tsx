'use client'

import SpriteImage from '@/components/common/SpriteImage'
import { REWARD_CREDITS } from '@/constants/sprites'

type Props = {
  /** 섬에 아직 나누지 않은 크레딧(가용) — 많을수록 더 풍성한 단계 이미지 */
  floating: number
  /** 0일 때 흐리게(버튼 비활성과 맞춤) */
  dimWhenEmpty?: boolean
  /** 한 칸을 화면에 보여 줄 때 가로 크기(px) */
  displayWidth?: number
  className?: string
}

const MAX_CREDIT_STAGE = 500
const CREDIT_STEP = 30

/**
 * 크레딧 0~299 구간: `credit1`~`credit10` 프레임으로 단계 표시.
 * - 30 단위로 다음 단계로 넘어가며, 0도 1단계(`credit1`)로 보입니다.
 */
function creditTierFrameName(floating: number): string {
  const clamped = Math.max(0, Math.min(floating, 299))
  const tier = Math.min(10, Math.floor(clamped / CREDIT_STEP) + 1)
  /**
   * 아틀라스 원본에 `credit5~7` 프레임이 없어,
   * 중간 단계는 인접 프레임으로 자연스럽게 보간해 사용합니다.
   */
  const tierToFrame: Record<number, string> = {
    1: 'credit1',
    2: 'credit2',
    3: 'credit3',
    4: 'credit4',
    5: 'credit4',
    6: 'credit8',
    7: 'credit8',
    8: 'credit8',
    9: 'credit9',
    10: 'credit10',
  }
  return tierToFrame[tier] ?? 'credit1'
}

/**
 * 아이 미션 섬 가운데: 크레딧이 쌓일수록 동전 더미가 겹쳐 보이게 렌더링합니다.
 * - 기존 그리드 크롭 방식(잘림 이슈)을 제거해, 어떤 화면에서도 안정적으로 보입니다.
 */
export default function FloatingCreditsStackVisual({
  floating,
  dimWhenEmpty = true,
  displayWidth = 58,
  className = '',
}: Props) {
  /** 요청사항: 크레딧 시각 단계 최대값은 500으로 제한합니다. */
  const clamped = Math.max(0, Math.min(floating, MAX_CREDIT_STAGE))
  /**
   * `credit2`처럼 회전 프레임은 세로 비율이 커서 기본 높이(0.92배)로는 상단이 잘릴 수 있습니다.
   * 작은 화면에서도 잘리지 않게 표시 박스 높이를 넉넉히 잡습니다.
   */
  const displayHeight = Math.round(displayWidth * 1.7)

  const opacityClass = floating <= 0 && dimWhenEmpty ? 'opacity-30' : 'opacity-100'
  const isFinal = clamped >= 500
  const isGoldBoxPhase = clamped >= 300 && clamped < 500
  const showCrown = clamped >= 400 && clamped < 500
  const diamondCount = isGoldBoxPhase ? Math.max(0, Math.floor((clamped - 300) / CREDIT_STEP)) : 0
  const creditFrame = creditTierFrameName(clamped)

  return (
    <div
      className={`relative shrink-0 ${opacityClass} ${className}`.trim()}
      style={{ width: displayWidth, height: displayHeight }}
      aria-hidden
    >
      {/** 500 달성: 최종 프레임 `gold_and_crown` 단일 표시 */}
      {isFinal ? (
        <span className="absolute left-1/2 bottom-0" style={{ transform: 'translateX(-50%)' }}>
          <SpriteImage
            sheet={REWARD_CREDITS}
            frame="gold_and_crown"
            width={Math.max(48, Math.round(displayWidth * 1.15))}
            clipRotated={false}
            className="select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
          />
        </span>
      ) : isGoldBoxPhase ? (
        <>
          <span className="absolute left-1/2 bottom-0" style={{ transform: 'translateX(-50%)' }}>
            <SpriteImage
              sheet={REWARD_CREDITS}
              frame="gold_box"
              width={Math.max(42, Math.round(displayWidth))}
              clipRotated={false}
              className="select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
            />
          </span>
          {Array.from({ length: diamondCount }).map((_, i) => (
            <span
              key={`diamond-${i}`}
              className="absolute left-1/2"
              style={{
                bottom: Math.max(6, Math.round(displayHeight * 0.38 + i * 2)),
                transform: `translateX(${(i - (diamondCount - 1) / 2) * 10}px)`,
              }}
            >
              <SpriteImage
                sheet={REWARD_CREDITS}
                frame="diamond"
                width={Math.max(14, Math.round(displayWidth * 0.24))}
                clipRotated={false}
                className="select-none"
              />
            </span>
          ))}
          {showCrown ? (
            <span
              className="absolute left-1/2"
              style={{ bottom: Math.max(16, Math.round(displayHeight * 0.64)), transform: 'translateX(-50%)' }}
            >
              <SpriteImage
                sheet={REWARD_CREDITS}
                frame="crown"
                width={Math.max(18, Math.round(displayWidth * 0.3))}
                clipRotated={false}
                className="select-none"
              />
            </span>
          ) : null}
        </>
      ) : (
        <span className="absolute left-1/2 bottom-0" style={{ transform: 'translateX(-50%)' }}>
          <SpriteImage
            sheet={REWARD_CREDITS}
            frame={creditFrame}
            width={Math.max(36, Math.round(displayWidth))}
            clipRotated={false}
            className="select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
          />
        </span>
      )}
    </div>
  )
}
