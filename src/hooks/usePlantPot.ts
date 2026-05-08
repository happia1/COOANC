'use client'

/**
 * 화분(식물) 상태를 Supabase `child_stats` 와 동기화하는 훅입니다.
 *
 * 비개발자 설명:
 * - 「물 주기」를 누르면 보유 하트가 1 줄고, 식물 진행 바가 조금 찹니다.
 * - 단계는 0(씨앗)부터 7(다 익은 열매)까지예요.
 * - 한 단계 오를 때마다 `water()` 가 `{ type: 'grew', newStage }` 를 돌려주고, 화면(`PlantStageCelebrationModal`)에서 팝업·콘페티를 띄웁니다.
 * - 완성(7단계) 이후에는 물 주기 탭 시 초기화되거나, 「씨앗 고르기」에서 `resetPot`으로 나무를 다시 정합니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
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

/**
 * 물 주기 결과
 * - `grew`: 하트 소모 후 **새 성장 단계**에 도달(중간 레벨업이든 최종 완성이든 동일 — `newStage` 확인)
 */
export type WaterResult = 'ok' | 'no_hearts' | { type: 'grew'; newStage: PlantStage }

const DEFAULT_TREE: PlantTreeId = 'apple'

export function usePlantPot(childId: string) {
  const supabase = createClient()
  const [pot, setPot] = useState<PotState | null>(null)
  const [hearts, setHearts] = useState(0)
  const [loading, setLoading] = useState(true)
  /**
   * DB 에 `pot_tree_id` 가 없어 서버에서는 나무 종류를 읽지 못합니다.
   * 이 디바이스 세션 안에서만 `씨앗 고르기`로 선택한 나무를 기억합니다(자녀 바뀔 때 초기화).
   */
  const chosenTreeRef = useRef<PlantTreeId>(DEFAULT_TREE)

  useEffect(() => {
    chosenTreeRef.current = DEFAULT_TREE
  }, [childId])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('child_stats')
      .select('hearts, pot_stage, pot_hearts_used, pot_completed')
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

    setHearts(readChildStatInt(data.hearts))
    setPot({
      treeId: chosenTreeRef.current,
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

  /**
   * Realtime: 미션 완료 등으로 `child_stats` 가 바뀌면 즉시 반영합니다.
   * 비개발자 설명: 새로 받은 하트가 훅 안에 잠시 누락되는 사이 「물 없어요」 가 잘못 뜨던 문제 방지.
   */
  useEffect(() => {
    const channel = supabase
      .channel(`use-plant-pot-stats-${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'child_stats',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          const row = (payload.new ?? {}) as Record<string, unknown>
          if (Object.prototype.hasOwnProperty.call(row, 'hearts')) {
            setHearts(readChildStatInt(row.hearts))
          }
          /** pot 진행도도 함께 들어왔으면 같이 갱신 — 부모가 DB 에서 화분을 손봐도 자녀 화면 동기화 */
          const hasPotField =
            Object.prototype.hasOwnProperty.call(row, 'pot_stage') ||
            Object.prototype.hasOwnProperty.call(row, 'pot_hearts_used') ||
            Object.prototype.hasOwnProperty.call(row, 'pot_completed')
          if (hasPotField) {
            setPot((prev) => {
              if (!prev) return prev
              const stageRaw = Object.prototype.hasOwnProperty.call(row, 'pot_stage')
                ? readChildStatInt(row.pot_stage)
                : prev.stage
              const stage = Math.min(7, Math.max(0, stageRaw)) as PlantStage
              const heartsUsed = Object.prototype.hasOwnProperty.call(row, 'pot_hearts_used')
                ? readChildStatInt(row.pot_hearts_used)
                : prev.heartsUsed
              const completed = Object.prototype.hasOwnProperty.call(row, 'pot_completed')
                ? Boolean(row.pot_completed)
                : prev.completed
              return {
                ...prev,
                stage,
                heartsUsed,
                heartsNeeded: HEARTS_PER_STAGE[stage],
                completed,
              }
            })
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [childId, supabase])

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

    /**
     * Realtime 이 잠깐 늦거나 미션 완료 응답이 stats 만 갱신했을 때
     * 훅 내부 `hearts` 가 잠시 0 으로 보일 수 있어, 항상 최신 DB 값을 한 번 더 확인합니다.
     * 비개발자: 하트가 분명히 있는데 「물이 없어요」 라고 잘못 뜨던 현상을 막습니다.
     */
    const { data: freshRow, error: freshErr } = await supabase
      .from('child_stats')
      .select('hearts')
      .eq('child_id', childId)
      .maybeSingle()
    const freshHearts = freshErr || !freshRow ? hearts : readChildStatInt(freshRow.hearts)

    if (freshHearts <= 0) {
      if (freshHearts !== hearts) setHearts(freshHearts)
      return 'no_hearts'
    }

    const newHeartsUsed = pot.heartsUsed + 1
    const needed = HEARTS_PER_STAGE[pot.stage]
    const levelUp = needed > 0 && newHeartsUsed >= needed

    const newStage = levelUp ? (Math.min(pot.stage + 1, 7) as PlantStage) : pot.stage
    const newHeartsUsedAfter = levelUp ? 0 : newHeartsUsed
    const isCompleted = newStage === 7

    const { error } = await supabase
      .from('child_stats')
      .update({
        hearts: freshHearts - 1,
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

    if (levelUp) return { type: 'grew', newStage }
    return 'ok'
  }, [pot, hearts, childId, supabase, refresh])

  /** 씨앗 고르기 확인 시 — 단계 초기화 + 선택한 나무 id 저장 */
  const resetPot = useCallback(
    async (treeId: PlantTreeId = DEFAULT_TREE) => {
      chosenTreeRef.current = treeId
      await supabase
        .from('child_stats')
        .update({
          pot_stage: 0,
          pot_hearts_used: 0,
          pot_completed: false,
        })
        .eq('child_id', childId)
      await refresh()
    },
    [childId, supabase, refresh],
  )

  return { pot, hearts, loading, water, resetPot, refresh }
}
