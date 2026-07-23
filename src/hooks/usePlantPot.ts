'use client'

/**
 * 화분(식물) 상태를 Supabase `child_stats` 와 동기화하는 훅입니다.
 *
 * 비개발자 설명:
 * - 「물 주기」를 누르면 보유 하트가 1 줄고, 식물 진행 바가 조금 찹니다.
 * - 사과는 0(씨앗)~7단계, 다른 과일은 1~7단계로 자라요.
 * - 한 단계 오를 때마다 `water()` 가 `{ type: 'grew', newStage }` 를 돌려주고, 화면(`PlantStageCelebrationModal`)에서 팝업·콘페티를 띄웁니다.
 * - 완성(7단계) 이후 「씨앗 고르기」는 `buySeed`로 크레딧을 쓰고 새 씨앗을 심습니다.
 * - `resetPot`은 크레딧 없이 진행만 초기화하는 보조 경로(API 폴백)입니다. 씨앗 모달과 함께 쓰지 마세요.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clampPotStageForTree,
  getHeartsNeededForStage,
  getInitialStageAfterSeed,
  normalizePlantPotProgress,
  needsPotSeedSelection,
  readPotTreeIdFromDb,
  resolveHasChosenSeed,
  resolveTreeId,
  type PlantStage,
  type PlantTreeId,
} from '@/constants/plantTrees'
import { createClient } from '@/lib/supabase/client'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import type { PlantHarvestCelebrate } from '@/lib/plantHarvest'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'
import {
  hasPlantChosenSeedInSession,
  markPlantChosenSeedInSession,
} from '@/lib/plantChosenSeedStorage'

export type PotState = {
  treeId: PlantTreeId
  stage: PlantStage
  heartsUsed: number
  heartsNeeded: number
  completed: boolean
  /** `plant_seed_purchases` 또는 buySeed 성공 후 true — false 면 씨앗 선택만 가능 */
  hasChosenSeed: boolean
}

/**
 * 물 주기 결과
 * - `grew`: 하트 소모 후 **새 성장 단계**에 도달(중간 레벨업이든 최종 완성이든 동일 — `newStage` 확인)
 */
export type WaterResult =
  | 'ok'
  | 'no_hearts'
  /** 단계 상승 축하 팝업이 떠 있는 동안(잠금 중) 들어온 물주기 — 하트 소모 없음 */
  | 'locked'
  | { type: 'grew'; newStage: PlantStage; harvest?: PlantHarvestCelebrate }

export type BuySeedResult =
  | { ok: true; newCredits: number; treeId: PlantTreeId }
  | { ok: false; code: 'insufficient_credits'; required: number; current: number; shortfall: number; message: string }
  | { ok: false; code: 'error'; message: string }

const DEFAULT_TREE: PlantTreeId = 'apple'

const POT_SELECT = 'hearts, pot_stage, pot_hearts_used, pot_completed, pot_tree_id' as const

/**
 * 물주기 API 성공 JSON으로 로컬 화분 상태를 만듭니다.
 * `refresh()` 전에 호출해 막대·그림이 바로 바뀌게 합니다(지연·캐시 대비).
 */
function potStateFromWaterResponse(
  treeId: PlantTreeId,
  pot_stage: unknown,
  pot_hearts_used: unknown,
  pot_completed: unknown,
  hasChosenSeed: boolean,
): PotState {
  const stageDb = clampPotStageForTree(treeId, readChildStatInt(pot_stage))
  const heartsUsedRaw = readChildStatInt(pot_hearts_used)
  const completedRaw = Boolean(pot_completed)
  const n = normalizePlantPotProgress(stageDb, heartsUsedRaw, completedRaw, treeId)
  return {
    treeId,
    stage: n.stage,
    heartsUsed: n.heartsUsed,
    heartsNeeded: getHeartsNeededForStage(treeId, n.stage),
    completed: n.completed,
    hasChosenSeed,
  }
}

async function loadHasChosenSeed(
  supabase: ReturnType<typeof createClient>,
  childId: string,
  treeId: PlantTreeId,
  normalized: { stage: PlantStage; heartsUsed: number; completed: boolean },
): Promise<boolean> {
  const { count, error } = await supabase
    .from('plant_seed_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId)

  return resolveHasChosenSeed(treeId, normalized, {
    purchaseCount: error ? null : (count ?? 0),
    sessionFlag: hasPlantChosenSeedInSession(childId),
  })
}

export function usePlantPot(
  childId: string,
  options?: {
    /**
     * 물주기 API 가 성공한 뒤 `child_stats` 일부를 돌려줄 때 — 상단 레벨 카드 `stats` 와 동기화합니다.
     * 비개발자: 화분 쪽 숫자만 바뀌고 위 카드 하트는 그대로인 현상을 막습니다.
     */
    onPlantStatsSynced?: (patch: Record<string, unknown>) => void
    /** 물주기 API 요청이 진행 중인 동안 true — ChildScreen의 pendingStatsWritesRef 카운터와 연결됩니다. */
    onWaterPending?: (pending: boolean) => void
  },
) {
  /**
   * 렌더마다 `createClient()`를 호출하면 안 됩니다.
   * - 인자로 `createClient()`를 넘기는 `useRef(createClient())`와 같이, 매번 새 브라우저 클라이언트를 만들면
   *   Supabase 내부 구독·상태가 꼬이고 React 가 「아직 마운트되지 않았는데 상태를 갱신한다」고 경고할 수 있습니다.
   * - 싱글톤이어도 **호출 자체가 매 프레임 실행**되는 것은 부담이므로 `useMemo`로 한 번만 만듭니다.
   */
  const supabase = useMemo(() => createClient(), [])
  const [pot, setPot] = useState<PotState | null>(null)
  const [hearts, setHearts] = useState(0)
  /** 빠른 연속 탭은 React 재렌더 전에도 들어오므로, 다음 탭이 즉시 최신 숫자를 읽도록 ref를 함께 유지합니다. */
  const potRef = useRef<PotState | null>(null)
  const heartsRef = useRef(0)
  const [loading, setLoading] = useState(true)
  /** 물주기 API를 순차 처리하기 위한 큐 — 클릭은 로컬에서 바로 반영하고, 서버 요청은 순서대로 보냅니다. */
  const waterQueueRef = useRef<Promise<WaterResult>>(Promise.resolve<WaterResult>('ok'))
  /** 부모가 넘긴 콜백은 매 렌더마다 바뀔 수 있어 ref 로 최신만 읽습니다(물주기 `water` 의존성 안정화). */
  const onPlantStatsSyncedRef = useRef(options?.onPlantStatsSynced)
  onPlantStatsSyncedRef.current = options?.onPlantStatsSynced
  const onWaterPendingRef = useRef(options?.onWaterPending)
  onWaterPendingRef.current = options?.onWaterPending
  /** 큐에 쌓인 물주기 요청 수 — 0→1, 1→0 전이에서만 onWaterPending을 알립니다 */
  const pendingWaterCountRef = useRef(0)
  const lastConfirmedWaterRef = useRef<{
    hearts: number
    pot_stage: number
    pot_hearts_used: number
    pot_completed: boolean
  } | null>(null)
  const refreshAfterWaterQueueRef = useRef(false)
  /**
   * 단계 상승(레벨업) 경계 잠금 — 낙관적 계산에서 levelUp이 확정되는 순간 true.
   * 이후 들어오는 water() 호출은 즉시 'locked'를 돌려주고 하트를 건드리지 않습니다.
   * `stageTransitionLockRef`는 water() 내부의 동기 가드용, `stageLocked`는 버튼 등 UI에 반응형으로 전달합니다.
   */
  const stageTransitionLockRef = useRef(false)
  const [stageLocked, setStageLocked] = useState(false)
  /**
   * 화분 "생애주기" 세대 번호 — 7단계 완성(재심기 대기) 또는 새 씨앗 심기 성공 시 +1.
   * 물주기 호출 시점의 세대를 캡처해 뒀다가, 큐에서 실제 서버 전송 직전 세대가 달라졌으면
   * (그 사이 완성·재심기가 끼어든 것) 이미 낡은 요청이므로 전송하지 않고 버립니다.
   */
  const potGenerationRef = useRef(0)

  /** `syncStats`: true 면 상단 레벨 카드 `stats.hearts` 도 맞춥니다(물주기 성공 등). refresh 는 false 로 훅만 갱신합니다. */
  const syncHeartsFromDb = useCallback((value: unknown, syncStats = true) => {
    const h = readChildStatInt(value)
    heartsRef.current = h
    setHearts(h)
    if (syncStats) {
      onPlantStatsSyncedRef.current?.({ hearts: h })
    }
  }, [])

  useEffect(() => {
    heartsRef.current = hearts
  }, [hearts])

  useEffect(() => {
    potRef.current = pot
  }, [pot])

  /**
   * 브라우저에서 pot_* 정규화 UPDATE 가 실패했을 때, 같은 작업을 서버 세션으로 한 번 더 시도합니다.
   * (하트·다른 컬럼은 건드리지 않습니다.)
   */
  const serverRepairPlantNormalize = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch('/api/child/plant-repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId }),
        credentials: 'same-origin',
      })
      return r.ok
    } catch {
      return false
    }
  }, [childId])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/child/plant-pot-state?childId=${encodeURIComponent(childId)}`,
        { credentials: 'same-origin' },
      )
      const { data: payload, parseError } = await parseJsonFromResponse<{
        ok?: boolean
        treeId?: string
        stage?: number
        heartsUsed?: number
        heartsNeeded?: number
        completed?: boolean
        hasChosenSeed?: boolean
        hearts?: number
      }>(res)

      if (!parseError && res.ok && payload?.ok === true && payload.treeId != null) {
        const tid = resolveTreeId(payload.treeId)
        const stage = clampPotStageForTree(tid, readChildStatInt(payload.stage))

        setPot((prev) => ({
          treeId: tid,
          stage,
          heartsUsed: readChildStatInt(payload.heartsUsed),
          heartsNeeded:
            typeof payload.heartsNeeded === 'number'
              ? payload.heartsNeeded
              : getHeartsNeededForStage(tid, stage),
          completed: Boolean(payload.completed),
          hasChosenSeed:
            Boolean(payload.hasChosenSeed) ||
            hasPlantChosenSeedInSession(childId) ||
            Boolean(prev?.hasChosenSeed),
        }))
        if (typeof payload.hearts === 'number') {
          syncHeartsFromDb(payload.hearts, false)
        }
        setLoading(false)
        return
      }
    } catch (e) {
      console.warn('[usePlantPot] plant-pot-state API fallback', e)
    }

    const { data: initialData, error } = await supabase
      .from('child_stats')
      .select(POT_SELECT)
      .eq('child_id', childId)
      .maybeSingle()

    if (error) {
      console.warn('[usePlantPot] fetch error', error.message)
      setLoading(false)
      return
    }
    if (!initialData) {
      setLoading(false)
      return
    }

    let data = initialData

    const treeIdEarly = readPotTreeIdFromDb(data.pot_tree_id)
    const stageRaw = readChildStatInt(data.pot_stage)
    const stageDb = clampPotStageForTree(treeIdEarly, stageRaw)
    const heartsUsedDb = readChildStatInt(data.pot_hearts_used)
    const completedDb = data.pot_completed ?? false

    const normalized = normalizePlantPotProgress(stageDb, heartsUsedDb, completedDb, treeIdEarly)
    const needsDbRepair =
      normalized.stage !== stageDb ||
      normalized.heartsUsed !== heartsUsedDb ||
      normalized.completed !== completedDb

    if (needsDbRepair) {
      const { error: fixErr } = await supabase
        .from('child_stats')
        .update({
          pot_stage: normalized.stage,
          pot_hearts_used: normalized.heartsUsed,
          pot_completed: normalized.completed,
        })
        .eq('child_id', childId)
      if (fixErr) {
        console.warn('[usePlantPot] pot progress repair failed', fixErr.message)
        /** 브라우저 직접 UPDATE 가 막히면 쿠키 세션 API로 정규화만 다시 시도합니다 */
        const recovered = await serverRepairPlantNormalize()
        if (recovered) {
          const { data: dataAfter, error: refetchErr } = await supabase
            .from('child_stats')
            .select(POT_SELECT)
            .eq('child_id', childId)
            .maybeSingle()
          if (!refetchErr && dataAfter) {
            data = dataAfter
          }
        }
      } else {
        const { data: dataAfter, error: refetchErr } = await supabase
          .from('child_stats')
          .select(POT_SELECT)
          .eq('child_id', childId)
          .maybeSingle()
        if (!refetchErr && dataAfter) {
          data = dataAfter
        }
      }
    }

    const treeId = readPotTreeIdFromDb(data.pot_tree_id)
    const stageRawFinal = readChildStatInt(data.pot_stage)
    const stageDbFinal = clampPotStageForTree(treeId, stageRawFinal)
    const heartsUsedFinal = readChildStatInt(data.pot_hearts_used)
    const completedFinal = data.pot_completed ?? false
    const normalizedFinal = normalizePlantPotProgress(
      stageDbFinal,
      heartsUsedFinal,
      completedFinal,
      treeId,
    )

    const purchasedFlag = await loadHasChosenSeed(supabase, childId, treeId, normalizedFinal)

    setPot((prev) => {
      const hasChosenSeed = purchasedFlag || Boolean(prev?.hasChosenSeed)
      return {
        treeId,
        stage: normalizedFinal.stage,
        heartsUsed: normalizedFinal.heartsUsed,
        heartsNeeded: getHeartsNeededForStage(treeId, normalizedFinal.stage),
        completed: normalizedFinal.completed,
        hasChosenSeed,
      }
    })
    syncHeartsFromDb(data.hearts, false)
    setLoading(false)
  }, [childId, supabase, serverRepairPlantNormalize, syncHeartsFromDb])

  /**
   * 미션 완료 낙관적 UI — ChildScreen 이 `stats.hearts` 를 올린 직후 같은 만큼 훅의 `hearts` 도 올립니다.
   * 화분이 로드된 뒤 화면이 `plantHearts` 위주로 그릴 때, DB/Realtime 을 기다리지 않고 숫자가 바로 맞습니다.
   *
   * 비개발자: 미션 끝나자마자 위쪽 하트 숫자가 바로 올라가게 합니다.
   */
  const bumpHeartsForMissionOptimistic = useCallback((delta: number) => {
    if (delta <= 0) return
    setHearts((h) => h + delta)
  }, [])

  /**
   * 미션 완료 API 가 실패했을 때 — 아까 미리 올려 둔 하트만큼 훅에서 다시 뺍니다.
   * 비개발자: 저장이 안 되면 미리 올려 둔 숫자만 되돌립니다.
   */
  const rollbackMissionHeartsOptimistic = useCallback((delta: number) => {
    if (delta <= 0) return
    setHearts((h) => Math.max(0, h - delta))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** 중복 씨앗 구매(연타) 크레딧 — 홈 진입 시 1회 자동 환불 시도 */
  const duplicateRefundRanRef = useRef(false)
  useEffect(() => {
    if (loading || duplicateRefundRanRef.current) return
    duplicateRefundRanRef.current = true

    void (async () => {
      try {
        const res = await fetch('/api/child/plant-refund-duplicate-seeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId }),
          credentials: 'same-origin',
        })
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean
          refundedCredits?: number
          newCredits?: number
        }
        if (res.ok && json.success && readChildStatInt(json.refundedCredits) > 0) {
          onPlantStatsSyncedRef.current?.({
            credits: readChildStatInt(json.newCredits),
            credits_wallet: 0,
          })
          await refresh()
        }
      } catch {
        /* noop */
      }
    })()
  }, [loading, childId, refresh])

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
          // 각 물주기 UPDATE 이벤트는 뒤에 대기 중인 탭을 아직 포함하지 않습니다.
          // 큐가 끝난 뒤 마지막 API 응답으로 한 번만 확정해 숫자가 역행하지 않게 합니다.
          if (pendingWaterCountRef.current > 0) return
          if (Object.prototype.hasOwnProperty.call(row, 'hearts')) {
            const nextHearts = readChildStatInt(row.hearts)
            heartsRef.current = nextHearts
            setHearts(nextHearts)
          }
          /** pot 진행도도 함께 들어왔으면 같이 갱신 — 부모가 DB 에서 화분을 손봐도 자녀 화면 동기화 */
          const hasPotField =
            Object.prototype.hasOwnProperty.call(row, 'pot_stage') ||
            Object.prototype.hasOwnProperty.call(row, 'pot_hearts_used') ||
            Object.prototype.hasOwnProperty.call(row, 'pot_completed') ||
            Object.prototype.hasOwnProperty.call(row, 'pot_tree_id')
          if (hasPotField) {
            setPot((prev) => {
              if (!prev) return prev
              const treeId = Object.prototype.hasOwnProperty.call(row, 'pot_tree_id')
                ? readPotTreeIdFromDb(row.pot_tree_id)
                : prev.treeId
              const stageRaw = Object.prototype.hasOwnProperty.call(row, 'pot_stage')
                ? readChildStatInt(row.pot_stage)
                : prev.stage
              const stageDb = clampPotStageForTree(treeId, stageRaw)
              const heartsUsedRaw = Object.prototype.hasOwnProperty.call(row, 'pot_hearts_used')
                ? readChildStatInt(row.pot_hearts_used)
                : prev.heartsUsed
              const completedRaw = Object.prototype.hasOwnProperty.call(row, 'pot_completed')
                ? Boolean(row.pot_completed)
                : prev.completed
              const normalized = normalizePlantPotProgress(
                stageDb,
                heartsUsedRaw,
                completedRaw,
                treeId,
              )
              const nextPot = {
                ...prev,
                treeId,
                stage: normalized.stage,
                heartsUsed: normalized.heartsUsed,
                heartsNeeded: getHeartsNeededForStage(treeId, normalized.stage),
                completed: normalized.completed,
              }
              potRef.current = nextPot
              return nextPot
            })
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [childId, supabase])

  const water = useCallback(
    async (displayHearts?: number): Promise<WaterResult> => {
      if (stageTransitionLockRef.current) {
        return 'locked'
      }

      const prevPot = potRef.current
      if (!prevPot?.hasChosenSeed || needsPotSeedSelection(prevPot)) {
        return 'ok'
      }

      const stage7Reset = prevPot.stage === 7
      const prevHearts = Math.max(heartsRef.current, readChildStatInt(displayHearts))

      if (!stage7Reset && prevHearts <= 0) {
        return 'no_hearts'
      }

      let immediateGrowthResult: WaterResult | null = null
      if (!stage7Reset && prevHearts > 0) {
        const needed = prevPot.heartsNeeded
        const newHeartsUsed = prevPot.heartsUsed + 1
        const levelUp = needed > 0 && newHeartsUsed >= needed
        const newStage = levelUp ? (Math.min(prevPot.stage + 1, 7) as PlantStage) : prevPot.stage
        const newHeartsUsedAfter = levelUp ? 0 : newHeartsUsed
        const isCompleted = newStage === 7

        const optimisticPot = {
          ...prevPot,
          stage: newStage,
          heartsUsed: newHeartsUsedAfter,
          heartsNeeded: getHeartsNeededForStage(prevPot.treeId, newStage),
          completed: isCompleted,
        }
        heartsRef.current = prevHearts - 1
        potRef.current = optimisticPot
        setHearts(prevHearts - 1)
        setPot(optimisticPot)
        onPlantStatsSyncedRef.current?.({
          hearts: prevHearts - 1,
          pot_stage: newStage,
          pot_hearts_used: newHeartsUsedAfter,
          pot_completed: isCompleted,
        })

        /**
         * 레벨업 경계 — 축하 팝업이 닫힐 때까지 이후 water() 호출을 즉시 'locked'로 막습니다.
         * 완성(7단계)이면 세대도 올려 두어, 이 시점 이후 큐에 남을 수 있는 낡은 요청을
         * 재심기 이후에는 버리도록 합니다(같은 tick에서 도는 이번 호출 자체는 아래에서
         * generationAtCall 을 이 새 세대로 캡처하므로 영향받지 않습니다).
         */
        if (levelUp) {
          stageTransitionLockRef.current = true
          setStageLocked(true)
          // 중간 성장 팝업은 서버 왕복을 기다리지 않고 정확한 경계 탭에서 즉시 엽니다.
          // 최종 수확 단계만 서버가 만드는 수확 결과가 필요해 응답을 기다립니다.
          if (!isCompleted) {
            immediateGrowthResult = { type: 'grew', newStage }
          }
        }
        if (isCompleted) {
          potGenerationRef.current += 1
        }
      }

      const generationAtCall = potGenerationRef.current
      pendingWaterCountRef.current += 1
      if (pendingWaterCountRef.current === 1) {
        lastConfirmedWaterRef.current = null
        refreshAfterWaterQueueRef.current = false
        onWaterPendingRef.current?.(true)
      }

      const resultPromise = async (): Promise<WaterResult> => {
        if (potGenerationRef.current !== generationAtCall) {
          // 큐에 머무는 동안 화분이 재심기되어 더 이상 유효하지 않은 요청 — 그대로 버립니다.
          pendingWaterCountRef.current = Math.max(0, pendingWaterCountRef.current - 1)
          if (pendingWaterCountRef.current === 0) {
            lastConfirmedWaterRef.current = null
            refreshAfterWaterQueueRef.current = false
            onWaterPendingRef.current?.(false)
          }
          return 'ok'
        }
        try {
          const res = await fetch('/api/child/plant-water', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ childId }),
            credentials: 'same-origin',
          })
          const json = (await res.json().catch(() => ({}))) as {
            ok?: boolean
            code?: string
            grew?: boolean
            newStage?: number
            hearts?: number
            pot_stage?: number
            pot_hearts_used?: number
            pot_completed?: boolean
            reset?: boolean
            harvest?: PlantHarvestCelebrate
          }

          if (res.status === 400 && json?.code === 'NO_HEARTS') {
            refreshAfterWaterQueueRef.current = true
            return 'no_hearts'
          }
          if (res.status === 400 && json?.code === 'NO_SEED_CHOSEN') {
            refreshAfterWaterQueueRef.current = true
            return 'ok'
          }

          if (!res.ok || json?.ok !== true) {
            console.warn('[usePlantPot] plant-water API', res.status, json)
            refreshAfterWaterQueueRef.current = true
            return 'ok'
          }

          const hasConfirmedPotState =
            typeof json.hearts === 'number' &&
            typeof json.pot_stage === 'number' &&
            typeof json.pot_hearts_used === 'number' &&
            typeof json.pot_completed === 'boolean'

          if (!hasConfirmedPotState) {
            console.warn('[usePlantPot] plant-water incomplete payload', json)
            refreshAfterWaterQueueRef.current = true
            return 'ok'
          }

          lastConfirmedWaterRef.current = {
            hearts: json.hearts,
            pot_stage: json.pot_stage,
            pot_hearts_used: json.pot_hearts_used,
            pot_completed: json.pot_completed,
          }

          if (json.grew === true && typeof json.newStage === 'number') {
            const tid = prevPot.treeId ?? DEFAULT_TREE
            const ns = clampPotStageForTree(tid, json.newStage)
            if (ns === 7) {
              // 완성 — 다음 생애주기(재심기)를 위해 큐·대기 카운터를 정리합니다.
              // 큐와 대기 수는 finally에서 요청별로 정리합니다.
            }
            return {
              type: 'grew',
              newStage: ns,
              harvest: json.harvest,
            }
          }
          return 'ok'
        } catch (e) {
          console.warn('[usePlantPot] plant-water fetch', e)
          refreshAfterWaterQueueRef.current = true
          return 'ok'
        } finally {
          pendingWaterCountRef.current = Math.max(0, pendingWaterCountRef.current - 1)
          if (pendingWaterCountRef.current === 0) {
            const confirmed = lastConfirmedWaterRef.current
            if (refreshAfterWaterQueueRef.current) {
              await refresh()
            } else if (confirmed) {
              const nextPot = potStateFromWaterResponse(
                potRef.current?.treeId ?? DEFAULT_TREE,
                confirmed.pot_stage,
                confirmed.pot_hearts_used,
                confirmed.pot_completed,
                potRef.current?.hasChosenSeed ?? false,
              )
              heartsRef.current = confirmed.hearts
              potRef.current = nextPot
              setHearts(confirmed.hearts)
              setPot(nextPot)
              onPlantStatsSyncedRef.current?.(confirmed)
            }
            lastConfirmedWaterRef.current = null
            refreshAfterWaterQueueRef.current = false
            onWaterPendingRef.current?.(false)
          }
        }
      }

      waterQueueRef.current = waterQueueRef.current
        .then(resultPromise)
        .catch((err) => {
          console.warn('[usePlantPot] plant-water queue error', err)
          return 'ok'
        })

      return immediateGrowthResult ?? waterQueueRef.current
    },
    [childId, refresh],
  )

  /** 단계 상승 축하 팝업이 닫힐 때 호출 — 다시 연속 물주기를 허용합니다. */
  const unlockStageTransition = useCallback(() => {
    stageTransitionLockRef.current = false
    setStageLocked(false)
  }, [])

  /**
   * 씨앗 구매 — 크레딧 차감 + 화분·나무 종류 초기화 (`/api/child/plant-buy-seed`)
   */
  const buySeed = useCallback(async (treeId: PlantTreeId): Promise<BuySeedResult> => {
    // 미처리 물주기 요청이 남아 있으면 먼저 흘려보낸 뒤 씨앗 심기를 진행합니다(서버 상태 경합 방지).
    if (pendingWaterCountRef.current > 0) {
      await waterQueueRef.current.catch(() => {})
    }
    try {
      const res = await fetch('/api/child/plant-buy-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, treeId }),
        credentials: 'same-origin',
      })
      const { data: json, parseError } = await parseJsonFromResponse<{
        success?: boolean
        hasChosenSeed?: boolean
        error?: string
        detail?: string
        code?: string
        required?: number
        current?: number
        newCredits?: number
        treeId?: string
        hearts?: number
        pot_stage?: number
        pot_hearts_used?: number
        pot_completed?: boolean
        credits_piggy?: number
      }>(res)

      if (parseError || !json) {
        console.warn('[usePlantPot] buySeed parse', res.status)
        return {
          ok: false as const,
          code: 'error' as const,
          message: '서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.',
        }
      }

      if (
        res.status === 400 &&
        (json.error === 'insufficient_credits' || json.code === 'insufficient_credits')
      ) {
        const required = typeof json.required === 'number' ? json.required : 0
        const current = typeof json.current === 'number' ? json.current : 0
        const shortfall = Math.max(0, required - current)
        return {
          ok: false as const,
          code: 'insufficient_credits' as const,
          required,
          current,
          shortfall,
          message: `크레딧이 ${shortfall}개 부족해요!`,
        }
      }

      if (!res.ok || json.success !== true) {
        console.warn('[usePlantPot] buySeed', res.status, json)
        const apiMsg = typeof json.error === 'string' ? json.error : null
        const detail = typeof json.detail === 'string' ? json.detail : null
        const message = detail
          ? `${apiMsg ?? '요청 실패'} (${detail})`
          : apiMsg ?? '씨앗 심기에 실패했어요. 잠시 후 다시 시도해 주세요.'
        return {
          ok: false as const,
          code: 'error' as const,
          message,
        }
      }

      // 새로운 화분 생애주기 시작 — 이전 세대에서 큐에 남아 있던 물주기 요청은 이제 모두 무효화됩니다.
      potGenerationRef.current += 1

      const tid = resolveTreeId(json.treeId)
      const initialStage = getInitialStageAfterSeed(tid)
      markPlantChosenSeedInSession(childId)
      const newCredits = readChildStatInt(json.newCredits)
      const patch: Record<string, unknown> = {
        credits: newCredits,
        credits_wallet: 0,
        pot_stage: initialStage,
        pot_hearts_used: 0,
        pot_completed: false,
        pot_tree_id: tid,
      }
      if (typeof json.credits_piggy === 'number') {
        patch.credits_piggy = readChildStatInt(json.credits_piggy)
      }
      if (typeof json.hearts === 'number') patch.hearts = json.hearts
      onPlantStatsSyncedRef.current?.(patch)

      setPot({
        treeId: tid,
        stage: initialStage,
        heartsUsed: 0,
        heartsNeeded: getHeartsNeededForStage(tid, initialStage),
        completed: false,
        hasChosenSeed: true,
      })
      if (typeof json.hearts === 'number') {
        setHearts(readChildStatInt(json.hearts))
      }
      // 씨앗 심기 완료 후 서버 값으로 화분 상태를 다시 맞춥니다.
      void refresh()

      return { ok: true as const, newCredits, treeId: tid }
    } catch (e) {
      console.warn('[usePlantPot] buySeed fetch', e)
      return {
        ok: false as const,
        code: 'error' as const,
        message: '네트워크 오류가 있어요. 연결을 확인한 뒤 다시 시도해 주세요.',
      }
    }
  }, [childId, refresh])

  /** 크레딧 없이 화분만 초기화(클라이언트 실패 시 API 폴백). 씨앗 모달과 병행 호출하지 않습니다. */
  const resetPot = useCallback(
    async (treeId: PlantTreeId = DEFAULT_TREE) => {
      const { error } = await supabase
        .from('child_stats')
        .update({
          pot_stage: 0,
          pot_hearts_used: 0,
          pot_completed: false,
          pot_tree_id: treeId,
        })
        .eq('child_id', childId)
      if (error) {
        console.warn('[usePlantPot] resetPot client update failed', error.message)
        try {
          const r = await fetch('/api/child/plant-reset-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ childId }),
            credentials: 'same-origin',
          })
          if (!r.ok) {
            console.warn('[usePlantPot] resetPot API fallback failed', r.status)
          }
        } catch (e) {
          console.warn('[usePlantPot] resetPot API fallback', e)
        }
      }
      await refresh()
    },
    [childId, supabase, refresh],
  )

  return {
    pot,
    hearts,
    loading,
    water,
    stageLocked,
    unlockStageTransition,
    buySeed,
    resetPot,
    refresh,
    bumpHeartsForMissionOptimistic,
    rollbackMissionHeartsOptimistic,
  }
}
