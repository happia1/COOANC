'use client'

/**
 * 미션 **완료 시 지급** 보상을 한 줄로 표시 — 부모·자녀 화면이 같은 규칙을 쓰게 합니다.
 *
 * ━━ 단일 기준(표시·완료 API) ━━
 * - 숫자는 항상 `scaledMissionRewards(mission)` 과 동일 (배율 1·2·3배 반영).
 * - 아이콘: 동전=크레딧(총액) / 분홍 하트=애정(`child_stats.hearts`에 합산).
 * - 경험치(EXP)는 **미션 카드에는 표시하지 않음** (레벨과 연결되나 UI 에서는 숨김).
 * - 프로필의 「보유 크레딧·하트 총액」은 `child_stats` 이고, 여기는 **이 미션에서 받는 양**입니다.
 */
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'

export type ScaledReward = ReturnType<typeof scaledMissionRewards>

type Props = {
  /** 이미 `scaledMissionRewards(템플릿)` 로 계산한 보상(부모/자녀 공통) */
  reward: ScaledReward
  /** 스프라이트 한 변 px — 부모 루틴 12, 자녀 홈 13, 미션 탭 14 등 */
  iconSize: number
  /** 바깥 래퍼 className(행 전체) */
  className: string
  /** 접근성: 그룹 설명(선택) */
  ariaLabel?: string
}

export function MissionRewardIconTriple({
  reward,
  iconSize,
  className,
  ariaLabel: ariaLabelIn,
}: Props) {
  const ariaLabel = ariaLabelIn ?? `획득 보상: 크레딧 ${reward.credit}, 애정 하트 ${reward.heart}`
  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      <span className="inline-flex items-center gap-0" title="획득 크레딧(총액)">
        <SpriteImage
          sheet={ICONS}
          frame="credit"
          width={iconSize}
          clipRotated={false}
          className="shrink-0 select-none"
        />
        <span className="-ml-0.2 leading-none tabular-nums">{reward.credit}</span>
      </span>
      <span className="inline-flex items-center gap-0" title="애정 하트(프로필 하트에 더해짐)">
        <SpriteImage sheet={ICONS} frame="heart" width={iconSize} className="shrink-0 select-none" />
        <span className="-ml-0.2 leading-none tabular-nums">{reward.heart}</span>
      </span>
    </div>
  )
}
