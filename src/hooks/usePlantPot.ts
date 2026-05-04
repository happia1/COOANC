'use client'

/**
 * 화분(식물) 상태를 Supabase `child_stats` 와 동기화하는 훅입니다.
 *
 * 비개발자 설명:
 * - 「물 주기」를 누르면 보유 하트가 1 줄고, 식물 진행 바가 조금 찹니다.
 * - 단계는 0(씨앗)부터 7(다 익은 열매)까지예요.
 * - 완성(7단계) 이후에는 물 주기 탭 시 초기화되거나, 「씨앗 고르기」에서 `resetPot`으로 나무를 다시 정합니다.
 */

import { useCallback, useEffect, useState } from 'react'
import { HEARTS_PER_STAGE, type PlantStage, type PlantTreeId } from '@/constants/plantTrees'
import { createClient } from '@/lib/supabase/client'
import { readChildStatInt } from '@/lib/childCreditsSplit'

export type PotState = {
  treeId: PlantTreeId
  stage: PlantStage
  heartsUsed: number
  heartsNeeded: number
  completed: boolean
}

export type WaterResult = 'ok' | 'leveled_up' | 'completed' | 'no_hearts'

const DEFAULT_TREE: PlantTreeId = 'apple'

export function usePlantPot(childId: string) {
  const supabase = createClient()
  const [pot, setPot] = useState<PotState | null>(null)
  const [hearts, setHearts] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('child_stats')
      .select('hearts, pot_stage, pot_hearts_used, pot_completed, pot_tree_id')
      .eq('child_id', childId)
      .maybeSingle()

    if (error) {
      console.warn('[usePlantPot] fetch error', error.message)
      setLoading(false)
      return
    }
    if (!data) {
      setLoading(false)
      return
    }

    const stageRaw = readChildStatInt(data.pot_stage)
    const stage = Math.min(7, Math.max(0, stageRaw)) as PlantStage
    const treeRaw =
      typeof data.pot_tree_id === 'string' && data.pot_tree_id ? data.pot_tree_id : DEFAULT_TREE

    setHearts(readChildStatInt(data.hearts))
    setPot({
      treeId: treeRaw as PlantTreeId,
      stage,
      heartsUsed: readChildStatInt(data.pot_hearts_used),
      heartsNeeded: HEARTS_PER_STAGE[stage],
      completed: data.pot_completed ?? false,
    })
    setLoading(false)
  }, [childId, supabase])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const water = useCallback(async (): Promise<WaterResult> => {
    if (!pot) return 'ok'

    // 완성 상태면 자동 리셋(단계·하트 누적만 초기화, 나무 종류는 유지)
    if (pot.stage === 7 || pot.completed) {
      await supabase
        .from('child_stats')
        .update({ pot_stage: 0, pot_hearts_used: 0, pot_completed: false })
        .eq('child_id', childId)
      await refresh()
      return 'ok'
    }

    if (hearts <= 0) return 'no_hearts'

    const newHeartsUsed = pot.heartsUsed + 1
    const needed = HEARTS_PER_STAGE[pot.stage]
    const levelUp = needed > 0 && newHeartsUsed >= needed

    const newStage = levelUp ? (Math.min(pot.stage + 1, 7) as PlantStage) : pot.stage
    const newHeartsUsedAfter = levelUp ? 0 : newHeartsUsed
    const isCompleted = newStage === 7

    const { error } = await supabase
      .from('child_stats')
      .update({
        hearts: hearts - 1,
        pot_stage: newStage,
        pot_hearts_used: newHeartsUsedAfter,
        pot_completed: isCompleted,
      })
      .eq('child_id', childId)

    if (error) {
      console.warn('[usePlantPot] update error', error.message)
      return 'ok'
    }

    await refresh()

    if (isCompleted) return 'completed'
    if (levelUp) return 'leveled_up'
    return 'ok'
  }, [pot, hearts, childId, supabase, refresh])

  /** 씨앗 고르기 확인 시 — 단계 초기화 + 선택한 나무 id 저장 */
  const resetPot = useCallback(
    async (treeId: PlantTreeId = DEFAULT_TREE) => {
      await supabase
        .from('child_stats')
        .update({
          pot_stage: 0,
          pot_hearts_used: 0,
          pot_completed: false,
          pot_tree_id: treeId,
        })
        .eq('child_id', childId)
      await refresh()
    },
    [childId, supabase, refresh],
  )

  return { pot, hearts, loading, water, resetPot, refresh }
}
