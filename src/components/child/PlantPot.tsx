'use client'

/**
 * 화분 UI — 캐릭터 옆에 두는 작은 성장 위젯입니다.
 *
 * 비개발자 설명:
 * - 큰 그림은 「지금 식물이 어느 단계인지」를 보여 주는 PNG예요.
 * - 분홍 줄이 진행 바입니다. 하트로 물을 줄 때마다 조금씩 차요.
 * - 완성이 되면 「씨앗 고르기」로 다음 식물을 시작할 수 있어요.
 */

import Image from 'next/image'
import { STAGE_LABELS, STAGE_IMAGE } from '@/constants/plantTrees'
import type { PotState } from '@/hooks/usePlantPot'

type Props = {
  pot: PotState
  /** 완성(7단계) 직후 — 씨앗 선택 모달 열기 콜백 */
  onRequestSeedSelect?: () => void
}

export default function PlantPot({ pot, onRequestSeedSelect }: Props) {
  const imgSrc = STAGE_IMAGE[pot.stage]
  const label = STAGE_LABELS[pot.stage]
  const progress = pot.heartsNeeded > 0 ? Math.min(pot.heartsUsed / pot.heartsNeeded, 1) : 1
  const showSeedCta =
    pot.completed && pot.stage === 7 && typeof onRequestSeedSelect === 'function'

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      {/* 단계별 식물 스프라이트 — `/public/assets/img/missions/routine/plant/` */}
      <div
        className="relative h-14 w-14 transition-all duration-500"
        style={pot.completed ? { filter: 'drop-shadow(0 0 8px gold)' } : undefined}
        aria-label={`화분: ${label}`}
      >
        <Image src={imgSrc} alt={label} fill className="object-contain" sizes="56px" priority />
      </div>

      {/* 진행 바 — 완성(7단계)에서는 숨김 */}
      {!pot.completed && pot.stage < 7 && (
        <div className="mt-0.5 h-1.5 w-12 overflow-hidden rounded-full bg-white/30">
          <div
            className="h-full rounded-full bg-pink-400 transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* 단계 이름 */}
      <span className="mt-0.5 text-[9px] font-bold text-white/70">{label}</span>

      {showSeedCta ? (
        <button
          type="button"
          onClick={onRequestSeedSelect}
          className="pointer-events-auto mt-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-black text-pink-600 shadow-sm transition active:scale-95"
        >
          씨앗 고르기
        </button>
      ) : null}
    </div>
  )
}
