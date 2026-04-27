'use client'

/**
 * ChildScreen — 자녀 앱 단일 화면
 *
 * 3탭(홈·미션·마켓)을 하나의 풀스크린 화면으로 통합합니다.
 *
 * 비개발자 설명:
 * - 배경 이미지 위에 캐릭터가 서 있고, 하단에 오늘의 미션 카드가 가로로 스크롤됩니다.
 * - 상단 오른쪽 아이콘을 탭하면 마켓/코인/꾸미기/스티커 패널이 아래에서 올라옵니다.
 * - 왼쪽 상단 🚪 버튼을 누르면 부모 화면으로 나갑니다.
 *
 * 레이아웃 레이어(아래 → 위):
 *   L1. 배경 이미지 (tablet_kidsroom_background_portrait.png)
 *   L2. 캐릭터 스프라이트 (앵커포인트 기반 배치)
 *   L3. UI 오버레이 (상단 바 + 크레딧/하트 배지 + 미션 섹션)
 *   L4. 패널 오버레이 (마켓/코인/꾸미기/스티커 — 하단 슬라이드업)
 */

import { useRef, useState, useCallback, useMemo, useEffect, memo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import RapidTapConfirmModal from '@/components/child/RapidTapConfirmModal'
import SpriteImage from '@/components/common/SpriteImage'
import { CharacterSprite } from '@/components/sprites/CharacterSprite'
import { BUNNY_HOME_DISPLAY_SCALE, resolveHomeIslandStageSprite } from '@/lib/childHomeCharacterFromAvatar'
import { BACKGROUND_ANCHORS } from '@/constants/backgroundAnchors'
import { getUnlockedFeatures } from '@/constants/childScreenFeatures'
import { useContainerSize } from '@/hooks/useContainerSize'
import ChildMissionCard from '@/components/child/ChildMissionCard'
import ChildPanelOverlay, { type PanelType } from '@/components/child/ChildPanelOverlay'
import ChildLevelStatsCard from '@/components/child/ChildLevelStatsCard'
import { normalizeChildStatsCreditsSplit, mergeChildStatsPatch } from '@/lib/childCreditsSplit'
import { completionRateToHearts } from '@/lib/missionHeartCount'
import { isSpecialSectionMission, isRetiredSpecialMissionTitle } from '@/lib/specialMissionChips'
import { isRetiredRoutineMissionTitle } from '@/lib/routineChips'
import { compareRoutineFlowSortable, type RoutineFlowSortable } from '@/lib/routineChips'
import { mergePraiseStickerGrantsFromServer } from '@/lib/mergePraiseStickerGrantsFromServer'
import { ASSETS, CHILD_HOME_BACKGROUND_CACHE_BUST } from '@/constants/assets'
import type {
  ChildStats,
  DailyMissionWithTemplate,
  StoreItem,
  PurchaseRequest,
  PraiseStickerGrant,
  PraiseStickerPlacement,
} from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { fireMissionCardConfetti } from '@/lib/missionCardConfetti'
import { tryApplyCompletePayload } from '@/lib/applyDailyMissionCompleteStats'
import AllMissionCompleteOverlay from '@/components/child/AllMissionCompleteOverlay'
import ChildAlarmClockPopup from '@/components/child/ChildAlarmClockPopup'
import SleepModeScreen from '@/components/child/SleepModeScreen'
import MorningWakeScreen from '@/components/child/MorningWakeScreen'
import SleepReadyPopup from '@/components/child/SleepReadyPopup'
import SchoolTimePopup from '@/components/child/SchoolTimePopup'
import { readRoutineAlarmPrefs } from '@/lib/routineAlarmLocalPrefs'
import { resolveRoutineAlarmSoundUrl } from '@/lib/routineAlarmSounds'

// ─── 파티클 타입 정의 ────────────────────────────────────────────────────────

/**
 * 미션 완료 시 카드 위치 → 크레딧 배지로 날아가는 개별 파티클 데이터.
 *
 * 비개발자 설명: 각 파티클이 어디서 출발해서 어디로 가는지,
 *               어떤 종류(코인/하트/별)인지, 몇 ms 후에 출발할지를 담습니다.
 */
type Particle = {
  id: number
  startX: number  // 카드 중심 X (컨테이너 기준)
  startY: number  // 카드 중심 Y (컨테이너 기준)
  endX: number    // 크레딧 배지 중심 X (컨테이너 기준)
  endY: number    // 크레딧 배지 중심 Y (컨테이너 기준)
  type: 'coin' | 'heart' | 'star'
  delay: number   // 애니메이션 시작 지연(ms) — 여러 파티클이 조금씩 시차를 두고 날아갑니다
}

type Props = {
  childId: string
  childName: string
  /** 만 나이(세). null 이면 레벨만으로 기능 해금을 판단합니다. */
  ageYears: number | null
  /** 프로필 아바타 URL (캐릭터 종류 결정에 사용) */
  childAvatarUrl: string | null
  /** child_stats 초기값 */
  initialStats: ChildStats | null
  /** 오늘의 daily_missions (missions JOIN 포함) */
  dailyMissions: DailyMissionWithTemplate[]
  /** 오늘 날짜 YYYY-MM-DD (서울 기준) */
  today: string

  /** 칭찬 스티커 grants */
  initialPraiseGrants: PraiseStickerGrant[]
  /** 칭찬 스티커 placements */
  initialPraisePlacements: PraiseStickerPlacement[]

  /** 마켓 상품 목록 */
  marketEligibleItems: StoreItem[]
  initialHiddenStoreItemIds: string[]
  marketRequests: PurchaseRequest[]
  initialWishlistEntries: { storeItemId: string; quantity: number }[]

  /** 꾸미기 아이템 해금 인덱스 목록 */
  initialUnlockedItemIndexes: number[]

  /** 부모 화면으로 이동하는 href */
  exitHref: string
}

// ─── 파티클 서브 컴포넌트 ──────────────────────────────────────────────────

/**
 * 개별 파티클 컴포넌트 — particleFly 키프레임으로 목적지까지 날아갑니다.
 * CSS 변수 --tx / --ty 에 이동 거리를 주입해 키프레임이 활용합니다.
 *
 * 비개발자 설명: 코인(🪙), 하트(❤️), 별(⭐) 중 하나를 화면에 띄워
 *               카드에서 크레딧 배지 쪽으로 날아가게 만드는 컴포넌트입니다.
 */
const MissionParticle = memo(function MissionParticle({ particle: p }: { particle: Particle }) {
  const emoji = p.type === 'coin' ? '🪙' : p.type === 'heart' ? '❤️' : '⭐'
  return (
    <div
      style={{
        position: 'absolute',
        left: p.startX,
        top: p.startY,
        fontSize: 20,
        lineHeight: 1,
        '--tx': `${p.endX - p.startX}px`,
        '--ty': `${p.endY - p.startY}px`,
        animation: `particleFly 550ms cubic-bezier(0.25,0.46,0.45,0.94) ${p.delay}ms forwards`,
      } as React.CSSProperties}
    >
      {emoji}
    </div>
  )
})

/**
 * 크레딧 배지 주변 별 방사 이펙트.
 * badgeShine 상태가 true 일 때만 마운트됩니다.
 *
 * 비개발자 설명: 6개의 작은 점이 배지 주위에서 여섯 방향으로 퍼져나갑니다.
 */
function BadgeStarBurst({ badgeRef }: { badgeRef: React.RefObject<HTMLDivElement | null> }) {
  const rect = badgeRef.current?.getBoundingClientRect()
  if (!rect) return null
  /** 배지 중심 좌표 — fixed 기준이므로 직접 사용 가능 */
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  return (
    <div
      className="pointer-events-none fixed z-[70]"
      style={{ left: cx, top: cy }}
      aria-hidden
    >
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <div
          key={deg}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 8,
            height: 8,
            borderRadius: '50%',
            /** 짝수 인덱스: 황금색, 홀수: 흰색 */
            background: i % 2 === 0 ? '#FFD700' : '#FFFFFF',
            transformOrigin: 'center',
            transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(-20px)`,
            animation: `starBurst 0.5s ease-out ${i * 50}ms forwards`,
          }}
        />
      ))}
    </div>
  )
}

// ─── 미션 정렬 헬퍼 (MissionTab 와 동일 로직) ──────────────────────────────

function dmToSortable(dm: DailyMissionWithTemplate): RoutineFlowSortable | null {
  if (!dm.missions) return null
  return {
    title: dm.missions.title,
    block: dm.missions.block ?? null,
    scheduled_time: dm.scheduled_time ?? null,
  }
}

function orderedMissionsForSlider(list: DailyMissionWithTemplate[]): DailyMissionWithTemplate[] {
  const routineRows = list.filter((dm) => dm.missions && !isSpecialSectionMission(dm.missions))
  const specialRows = list.filter((dm) => dm.missions && isSpecialSectionMission(dm.missions))

  const sortedRoutine = [...routineRows].sort((a, b) => {
    const sa = dmToSortable(a)
    const sb = dmToSortable(b)
    if (!sa || !sb) return 0
    return compareRoutineFlowSortable(sa, sb)
  })
  const sortedSpecial = [...specialRows].sort((a, b) => {
    const ta = a.scheduled_time
    const tb = b.scheduled_time
    if (!ta && !tb) return (a.missions?.title ?? '').localeCompare(b.missions?.title ?? '', 'ko')
    if (!ta) return 1
    if (!tb) return -1
    return ta.localeCompare(tb)
  })

  return [...sortedRoutine, ...sortedSpecial]
}

/**
 * 자녀 앱 단일 화면 메인 컴포넌트
 */
export default function ChildScreen({
  childId,
  childName,
  ageYears,
  childAvatarUrl,
  initialStats,
  dailyMissions,
  today,
  initialPraiseGrants,
  initialPraisePlacements,
  marketEligibleItems,
  initialHiddenStoreItemIds,
  marketRequests,
  initialWishlistEntries,
  initialUnlockedItemIndexes,
  exitHref,
}: Props) {
  /** 전체 화면을 감싸는 컨테이너 ref — 캐릭터 높이 + 파티클 좌표 기준 계산에 사용 */
  const containerRef = useRef<HTMLDivElement>(null)
  const { height: containerH } = useContainerSize(containerRef)

  /** 크레딧 배지 ref — 동전 파티클이 날아가는 목적지(숫자·아이콘 줄) */
  const creditBadgeRef = useRef<HTMLDivElement>(null)
  /** Mission Complete 하트 5칸 ref — **애정 하트(미션 보상)** 파티클 목적지 */
  const missionHeartsRef = useRef<HTMLDivElement>(null)

  /** 현재 화면에 떠 있는 파티클 목록 */
  const [particles, setParticles] = useState<Particle[]>([])

  /** 크레딧 배지 반짝임 활성화 여부 */
  const [badgeShine, setBadgeShine] = useState(false)

  const router = useRouter()

  // ── 통계(크레딧/하트) ──────────────────────────────────────────────────────

  const [stats, setStats] = useState<ChildStats | null>(() =>
    initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null,
  )

  useEffect(() => {
    setStats(initialStats ? normalizeChildStatsCreditsSplit(initialStats) : null)
  }, [initialStats])

  const handleStatsUpdate = useCallback(
    (patch: { credits: number; credits_wallet: number; credits_piggy: number }) => {
      setStats((prev) => normalizeChildStatsCreditsSplit(mergeChildStatsPatch(prev, patch)))
    },
    [],
  )

  /** 총 크레딧 (지갑+저금통+돈바구니 합산) */
  const totalCredits = stats?.credits ?? 0

  /**
   * 부모가 저장한 「잘 준비」 알림 시각 (HH:MM) — child_stats.sleep_ready_time
   * 비개발자 설명: 이 시간이 되면 잠자리 준비 알림 팝업이 한 번 떠요.
   */
  const sleepReadyTimeHHMM = useMemo(() => {
    const t = initialStats?.sleep_ready_time?.trim()
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null
    const [h, m] = t.split(':')
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  }, [initialStats?.sleep_ready_time])

  /** 등원 알람 시각 — child_stats.school_time */
  const schoolTimeHHMM = useMemo(() => {
    const t = initialStats?.school_time?.trim()
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null
    const [h, m] = t.split(':')
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  }, [initialStats?.school_time])

  /** DB 플래그 — 주중·주말·전체 사용 (서버 기본값과 맞춤) */
  const schoolTimeEnabled = initialStats?.school_time_enabled ?? false
  const schoolTimeWeekday = initialStats?.school_time_weekday ?? true
  const schoolTimeWeekend = initialStats?.school_time_weekend ?? true
  const sleepReadyTimeEnabled = initialStats?.sleep_ready_time_enabled ?? true
  const sleepReadyTimeWeekday = initialStats?.sleep_ready_time_weekday ?? true
  const sleepReadyTimeWeekend = initialStats?.sleep_ready_time_weekend ?? true

  // ── 미션 완료 상태 ─────────────────────────────────────────────────────────

  const [done, setDone] = useState<Set<string>>(
    () => new Set(dailyMissions.filter((dm) => dm.is_completed).map((dm) => dm.id)),
  )
  const [missionList, setMissionList] = useState<DailyMissionWithTemplate[]>(dailyMissions)

  // ── 연속 탭 감지 ───────────────────────────────────────────────────────────

  /**
   * 최근 완료 처리된 타임스탬프(ms)를 기록합니다.
   * - 3초(3000ms) 이내에 5개 이상이 쌓이면 확인 팝업을 띄웁니다.
   * - ref를 사용해 리렌더링 없이 빠르게 갱신합니다.
   */
  const recentTapTimestamps = useRef<number[]>([])

  /**
   * 팝업이 열려있는 동안 처리를 보류한 미션 정보.
   * 확인/취소 후 이 정보를 기반으로 완료 또는 취소를 결정합니다.
   */
  const pendingMissionRef = useRef<{
    dm: DailyMissionWithTemplate
    cardRect: DOMRect
    creditReward: number
    heartReward: number
  } | null>(null)

  /** 연속 탭 확인 팝업 표시 여부 */
  const [rapidTapModalOpen, setRapidTapModalOpen] = useState(false)

  /**
   * 알람·뽀모도로 시계 팝업(ChildAlarmClockPopup) 열림 여부
   * 비개발자 설명: 캐릭터 옆 시계를 누르면 true 가 되고, 닫기로 false 가 됩니다.
   */
  const [clockPopupOpen, setClockPopupOpen] = useState(false)

  /** 전체 미션 완주 축하 오버레이 표시 여부 */
  const [showCelebration, setShowCelebration] = useState(false)
  /**
   * 같은 날·세션에서 축하 스케줄을 한 번만 걸기 위한 ref (useState 대신 stale closure 방지)
   * 비개발자 설명: 마지막 미션을 탭해 완료 처리할 때만 true 로 바뀌며, 날짜가 바뀌면 다시 false 로 돌아갑니다.
   */
  const celebrationShownRef = useRef(false)
  /** 700ms 뒤 오버레이 표시 예약 — API 실패 롤백 시 clearTimeout */
  /** DOM 환경에서 setTimeout 은 `number` 핸들을 돌려줌(Node 의 Timeout 타입과 혼동 주의) */
  const celebrationShowTimerRef = useRef<number | null>(null)
  /**
   * 오늘(이 브라우저 세션에서) 미션 완료로 누적한 코인 합.
   * 비개발자 설명: 화면에 다시 들어온 뒤 이미 끝낸 미션이 있으면 0에서 시작할 수 있습니다.
   */
  const [todayEarnedCredits, setTodayEarnedCredits] = useState(0)

  /** 미션 완주 후 수면 모드(잘자 화면) */
  const [isSleeping, setIsSleeping] = useState(false)
  /** 수면 모드 다음 아침 인사 화면 */
  const [showMorningWake, setShowMorningWake] = useState(false)
  /**
   * 루틴 기상 알람 시각 "HH:MM" — 부모가 알람을 끄면 null (자동 아침 인사 없음, 탭으로만 깸)
   * 비개발자 설명: 이 태블릿 브라우저에 저장된 루틴 알람 설정을 읽습니다.
   */
  const [routineWakeAlarmHHMM, setRoutineWakeAlarmHHMM] = useState<string | null>(null)

  /** 잘 준비 알림 팝업 — 하루 한 번(날짜 바뀌면 ref 리셋) */
  const [showSleepReady, setShowSleepReady] = useState(false)
  const sleepReadyShownRef = useRef(false)
  /** 등원 알림 팝업 — 하루 한 번 */
  const [showSchoolTime, setShowSchoolTime] = useState(false)
  const schoolTimeShownRef = useRef(false)
  /** 축하·수면·기상·다른 루틴 팝업이 떠 있으면 새 알림을 띄우지 않음 */
  const blockRoutineAlarmPopupsRef = useRef(false)

  /** 클라이언트에서만 루틴 기상 시각 로드 */
  useEffect(() => {
    const p = readRoutineAlarmPrefs()
    const t = p.wakeTime?.trim()
    if (p.notifyWake && t && /^\d{1,2}:\d{2}$/.test(t)) {
      const [hh, mm] = t.split(':')
      setRoutineWakeAlarmHHMM(`${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`)
    } else {
      setRoutineWakeAlarmHHMM(null)
    }
  }, [])

  useEffect(() => {
    setMissionList(dailyMissions)
    setDone(new Set(dailyMissions.filter((dm) => dm.is_completed).map((dm) => dm.id)))
  }, [dailyMissions])

  /** 날짜(오늘)이 바뀌면 축하·누적 코인 상태를 초기화합니다. */
  useEffect(() => {
    celebrationShownRef.current = false
    if (celebrationShowTimerRef.current != null) {
      clearTimeout(celebrationShowTimerRef.current)
      celebrationShowTimerRef.current = null
    }
    setShowCelebration(false)
    setTodayEarnedCredits(0)
    setIsSleeping(false)
    setShowMorningWake(false)
    sleepReadyShownRef.current = false
    setShowSleepReady(false)
    schoolTimeShownRef.current = false
    setShowSchoolTime(false)
  }, [today])

  /** 루틴 시각 알림은 ref 로 ‘하루 1회’만 — 축하·수면·아침 화면만 막음 */
  useEffect(() => {
    blockRoutineAlarmPopupsRef.current = !!(showCelebration || isSleeping || showMorningWake)
  }, [showCelebration, isSleeping, showMorningWake])

  /**
   * 잘 준비·등원 시각 도달 시 팝업 — 30초마다 현재 시각과 비교
   * 비개발자 설명: 배터리를 아끼려고 1초마다 돌리지 않고, 대략 반분 안에 맞춰 뜹니다.
   */
  useEffect(() => {
    if (!sleepReadyTimeHHMM && !schoolTimeHHMM) return
    const check = () => {
      if (blockRoutineAlarmPopupsRef.current) return
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const current = `${hh}:${mm}`
      const isWeekend = [0, 6].includes(now.getDay())

      const allowSleepReady =
        sleepReadyTimeHHMM &&
        sleepReadyTimeEnabled &&
        (isWeekend ? sleepReadyTimeWeekend : sleepReadyTimeWeekday)
      if (allowSleepReady && current === sleepReadyTimeHHMM && !sleepReadyShownRef.current) {
        sleepReadyShownRef.current = true
        setShowSleepReady(true)
        // #region agent log
        fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c8e235' },
          body: JSON.stringify({
            sessionId: 'c8e235',
            hypothesisId: 'H1',
            location: 'ChildScreen.tsx:routineAlarmCheck',
            message: 'sleep_ready popup triggered',
            data: { current, isWeekend },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion
      } else {
        const allowSchool =
          schoolTimeHHMM &&
          schoolTimeEnabled &&
          (isWeekend ? schoolTimeWeekend : schoolTimeWeekday)
        if (allowSchool && current === schoolTimeHHMM && !schoolTimeShownRef.current) {
          schoolTimeShownRef.current = true
          setShowSchoolTime(true)
          // #region agent log
          fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c8e235' },
            body: JSON.stringify({
              sessionId: 'c8e235',
              hypothesisId: 'H2',
              location: 'ChildScreen.tsx:routineAlarmCheck',
              message: 'school_time popup triggered',
              data: { current, isWeekend },
              timestamp: Date.now(),
            }),
          }).catch(() => {})
          // #endregion
        }
      }
    }
    check()
    const id = window.setInterval(check, 30000)
    return () => clearInterval(id)
  }, [
    sleepReadyTimeHHMM,
    schoolTimeHHMM,
    sleepReadyTimeEnabled,
    sleepReadyTimeWeekday,
    sleepReadyTimeWeekend,
    schoolTimeEnabled,
    schoolTimeWeekday,
    schoolTimeWeekend,
  ])

  /** 자정 자동 새로고침 */
  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    const ms = midnight.getTime() - now.getTime()
    const timer = setTimeout(() => router.refresh(), ms)
    return () => clearTimeout(timer)
  }, [router])

  /**
   * 포그라운드 복귀 시 미션 데이터 자동 동기화
   * - 부모 앱에서 크레딧·하트 설정을 바꾼 뒤 자녀가 앱으로 돌아오면
   *   router.refresh()로 서버에서 최신 missions 값을 다시 불러옵니다.
   * - 30초 이상 숨김 상태였을 때만 갱신해 과도한 요청을 방지합니다.
   */
  useEffect(() => {
    let hiddenAt: number | null = null

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (document.visibilityState === 'visible') {
        const elapsed = hiddenAt != null ? Date.now() - hiddenAt : Infinity
        if (elapsed >= 30_000) {
          router.refresh()
        }
        hiddenAt = null
      }
    }

    function onFocus() {
      const elapsed = hiddenAt != null ? Date.now() - hiddenAt : Infinity
      if (elapsed >= 30_000) {
        router.refresh()
      }
      hiddenAt = null
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [router])

  /** 폐지된 미션 제외 */
  const visibleMissions = useMemo(
    () =>
      missionList.filter((dm) => {
        const m = dm.missions
        if (!m) return true
        if (isRetiredSpecialMissionTitle(m.title)) return false
        if (isRetiredRoutineMissionTitle(m.title)) return false
        return true
      }),
    [missionList],
  )

  /** 정렬된 미션 목록 */
  const ordered = useMemo(() => orderedMissionsForSlider(visibleMissions), [visibleMissions])

  /** 완료된 카드는 슬라이더에서 숨김 */
  const incompleteOrdered = useMemo(
    () => ordered.filter((dm) => !done.has(dm.id)),
    [ordered, done],
  )

  /** 완료율 → 하트 수 (0~5) */
  const filledHearts = useMemo(
    () => completionRateToHearts(
      visibleMissions.filter((dm) => done.has(dm.id)).length,
      visibleMissions.length,
    ),
    [visibleMissions, done],
  )

  /**
   * 배지 반짝임 트리거 — 파티클이 모두 도착한 뒤(650 ms) 호출됩니다.
   *
   * 비개발자 설명: 코인이 배지에 닿으면 황금빛 빛남 + 숫자가 잠깐 커집니다.
   */
  const triggerBadgeShine = useCallback(() => {
    setBadgeShine(true)
    setTimeout(() => setBadgeShine(false), 600)
  }, [])

  /**
   * 미션 완료 핸들러.
   * - 기존 API 호출 로직(낙관적 완료 + 롤백)은 그대로 유지합니다.
   * - cardRect / creditReward / heartReward 를 추가로 받아 파티클을 생성합니다.
   *
   * 비개발자 설명: 카드를 탭하면 (1) 완료 처리 API를 호출하고,
   *               (2) 코인·하트 파티클을 배지 방향으로 날려 보냅니다.
   */
  /**
   * 실제 미션 완료 처리 — 파티클 생성 + API 호출.
   * 연속 탭 감지에서 확인을 받은 뒤에도 이 함수를 재사용합니다.
   */
  const commitMissionComplete = useCallback(
    (
      dm: DailyMissionWithTemplate,
      cardRect: DOMRect,
      creditReward: number,
      heartReward: number,
    ) => {
      /** 오늘(세션) 누적 코인 — 축하 팝업의 "+n"에 사용, API 실패 시 응답 분기에서 되돌립니다. */
      setTodayEarnedCredits((prev) => prev + creditReward)
      /**
       * 카드가 사라지는 순간 그 위치에서 컨페티(새로 추가).
       * 비개발자: “완료” 글자 화면 대신 색종이가 터지는 느낌으로 축하합니다.
       */
      fireMissionCardConfetti(cardRect)

      /** 낙관적 완료 — DOM에서 카드를 제거하기 전에 파티클을 먼저 띄웁니다 */
      const containerRect = containerRef.current?.getBoundingClientRect()
      const badgeRect = creditBadgeRef.current?.getBoundingClientRect()
      const missionHeartsRow = missionHeartsRef.current?.getBoundingClientRect()

      if (containerRect && badgeRect) {
        const startX = cardRect.left + cardRect.width / 2 - containerRect.left
        const startY = cardRect.top + cardRect.height / 2 - containerRect.top
        const endCoinX = badgeRect.left + badgeRect.width / 2 - containerRect.left
        const endCoinY = badgeRect.top + badgeRect.height / 2 - containerRect.top
        /**
         * 애정 하트는 상단 **Mission Complete** 막대(하트 5칸) 중심으로 날아갑니다.
         * (없으면 예전과 같이 크레딧 배지로 떨어짐)
         */
        const endHeartX = missionHeartsRow
          ? missionHeartsRow.left + missionHeartsRow.width / 2 - containerRect.left
          : endCoinX
        const endHeartY = missionHeartsRow
          ? missionHeartsRow.top + missionHeartsRow.height / 2 - containerRect.top
          : endCoinY

        const base = Date.now()
        const newParticles: Particle[] = [
          { id: base,     startX,            startY, endX: endCoinX, endY: endCoinY, type: 'coin', delay: 0   },
          { id: base + 1, startX: startX - 20, startY, endX: endCoinX, endY: endCoinY, type: 'coin', delay: 60  },
          { id: base + 2, startX: startX + 20, startY, endX: endCoinX, endY: endCoinY, type: 'coin', delay: 120 },
        ]
        if (heartReward > 0) {
          newParticles.push(
            { id: base + 3, startX, startY: startY + 10, endX: endHeartX, endY: endHeartY, type: 'heart', delay: 80 },
          )
        }
        setParticles((prev) => [...prev, ...newParticles])

        setTimeout(() => {
          setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)))
          triggerBadgeShine()
        }, 650)
      }

      setTimeout(() => {
        setDone((prev) => {
          const next = new Set([...prev, dm.id])
          const allNowDone = visibleMissions.every((m) => next.has(m.id))
          if (allNowDone && visibleMissions.length > 0 && !celebrationShownRef.current) {
            celebrationShownRef.current = true
            if (celebrationShowTimerRef.current != null) {
              clearTimeout(celebrationShowTimerRef.current)
            }
            celebrationShowTimerRef.current = window.setTimeout(() => {
              celebrationShowTimerRef.current = null
              setShowCelebration(true)
            }, 700)
          }
          return next
        })
      }, 220)

      void (async () => {
        try {
          const res = await fetch('/api/daily-mission/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dailyMissionId: dm.id, today, childId }),
          })
          const text = await res.text()
          let json: unknown = {}
          try {
            json = text ? JSON.parse(text) : {}
          } catch {
            /* 응답이 JSON이 아니면 stats 동기화 생략 */
          }
          if (res.ok) {
            setStats((prev) => tryApplyCompletePayload(prev, json) ?? prev)
          } else {
            setTodayEarnedCredits((p) => Math.max(0, p - creditReward))
            if (celebrationShowTimerRef.current != null) {
              clearTimeout(celebrationShowTimerRef.current)
              celebrationShowTimerRef.current = null
            }
            celebrationShownRef.current = false
            setShowCelebration(false)
            setDone((prev) => {
              const next = new Set(prev)
              next.delete(dm.id)
              return next
            })
          }
        } catch {
          setTodayEarnedCredits((p) => Math.max(0, p - creditReward))
          if (celebrationShowTimerRef.current != null) {
            clearTimeout(celebrationShowTimerRef.current)
            celebrationShowTimerRef.current = null
          }
          celebrationShownRef.current = false
          setShowCelebration(false)
          setDone((prev) => {
            const next = new Set(prev)
            next.delete(dm.id)
            return next
          })
        }
      })()
    },
    [today, childId, triggerBadgeShine, visibleMissions],
  )

  const handleMissionComplete = useCallback(
    (
      dm: DailyMissionWithTemplate,
      cardRect: DOMRect,
      creditReward: number,
      heartReward: number,
    ) => {
      if (done.has(dm.id)) return

      const now = Date.now()

      /**
       * 연속 탭 감지: 3초 이내 탭 타임스탬프만 남기고,
       * 5개 이상 쌓이면 확인 팝업을 띄웁니다.
       */
      recentTapTimestamps.current = [
        ...recentTapTimestamps.current.filter((t) => now - t < 3000),
        now,
      ]

      if (recentTapTimestamps.current.length >= 5) {
        /** 팝업 대기 중인 미션 정보를 저장하고 팝업을 엽니다 */
        pendingMissionRef.current = { dm, cardRect, creditReward, heartReward }
        setRapidTapModalOpen(true)

        /** 부모에게 연속 탭 알림을 백그라운드로 전송합니다 */
        void fetch('/api/child/rapid-tap-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mission_count: recentTapTimestamps.current.length }),
        }).catch(() => { /* 알림 전송 실패 시 조용히 무시 */ })

        return
      }

      /** 연속 탭 감지 통과 — 정상 완료 처리를 진행합니다 */
      commitMissionComplete(dm, cardRect, creditReward, heartReward)
    },
    [done, commitMissionComplete],
  )

  /**
   * 연속 탭 확인 팝업: "정말 다 했어!" 버튼 처리
   * - 보류된 미션을 실제 완료 처리하고 팝업을 닫습니다.
   * - 감지 카운터를 초기화해 직후 탭이 다시 팝업을 띄우지 않도록 합니다.
   */
  const handleRapidTapConfirm = useCallback(() => {
    const p = pendingMissionRef.current
    if (p && !done.has(p.dm.id)) {
      commitMissionComplete(p.dm, p.cardRect, p.creditReward, p.heartReward)
    }
    pendingMissionRef.current = null
    recentTapTimestamps.current = []
    setRapidTapModalOpen(false)
  }, [done, commitMissionComplete])

  /**
   * 연속 탭 확인 팝업: "미안.. 다시 할게" 버튼 처리
   * - 보류된 미션을 완료하지 않고 팝업만 닫습니다.
   */
  const handleRapidTapDeny = useCallback(() => {
    pendingMissionRef.current = null
    recentTapTimestamps.current = []
    setRapidTapModalOpen(false)
  }, [])

  // ── 스티커 상태 ────────────────────────────────────────────────────────────

  const [grants, setGrants] = useState(initialPraiseGrants)
  const [placements, setPlacements] = useState(initialPraisePlacements)
  const [praiseGrantsRevision, setPraiseGrantsRevision] = useState(0)

  useEffect(() => {
    setGrants((prev) => mergePraiseStickerGrantsFromServer(initialPraiseGrants, prev))
  }, [initialPraiseGrants])

  useEffect(() => {
    setPlacements(initialPraisePlacements)
  }, [initialPraisePlacements])

  const refreshStickerPlacements = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('praise_sticker_placements').select('*').eq('child_id', childId)
    if (data) setPlacements(data as PraiseStickerPlacement[])
  }, [childId])

  const clearPraiseStickerBoard = useCallback(
    (clearedAt?: string, meta?: { grantsDeleted?: boolean }) => {
      setPlacements([])
      if (meta?.grantsDeleted) {
        setGrants([])
        setPraiseGrantsRevision((r) => r + 1)
      }
      if (clearedAt) {
        setStats((prev) => (prev ? { ...prev, praise_board_cleared_at: clearedAt } : prev))
      }
    },
    [],
  )

  // ── 패널 상태 ──────────────────────────────────────────────────────────────

  const [activePanel, setActivePanel] = useState<PanelType>(null)

  // ── 기능 해금 ─────────────────────────────────────────────────────────────

  const features = useMemo(
    () => getUnlockedFeatures(stats?.current_level ?? 0, ageYears),
    [stats?.current_level, ageYears],
  )

  // ── 캐릭터 스프라이트 ─────────────────────────────────────────────────────

  const characterSprite = useMemo(
    () => resolveHomeIslandStageSprite(childAvatarUrl),
    [childAvatarUrl],
  )

  /** 배경 앵커 상수 */
  const anchor = BACKGROUND_ANCHORS.kids_background

  /**
   * 토끼(기본/토끼 프로필)일 때만 홈에서 살짝 더 크게 — `BUNNY_HOME_DISPLAY_SCALE` 배율을 곱합니다.
   * 비개발자: 여우·곰 등 다른 캐릭터 크기는 그대로 두고 토끼만 키웁니다.
   */
  const homeCharacterSizeMultiplier =
    characterSprite.character === 'bunny' ? BUNNY_HOME_DISPLAY_SCALE : 1

  /** 캐릭터 표시 높이 (px) — 배경 높이의 characterScale 비율(토끼는 추가 배율 적용) */
  const characterDisplayH =
    containerH > 0
      ? Math.round(containerH * anchor.characterScale * homeCharacterSizeMultiplier)
      : 0

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/**
       * 전체 화면 컨테이너 — fixed inset-0 로 ChildNavBar(z-50), 레이아웃 나가기 버튼(z-50) 위에 올립니다.
       * 비개발자 설명: 이 화면이 기존 탭 바를 완전히 가리고 단일 화면으로 동작합니다.
       */}
      <div
        ref={containerRef}
        className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
      >
        {/* ── L1: 배경 이미지 ─────────────────────────────────────────────── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/*
          배경 `objectPosition` x% = imageObjectPositionX(50=중앙, 작을수록 왼쪽·클수록 오른쪽)
        */}
        <img
          src={`${ASSETS.layouts.childHomeBackgroundSecondScreen}?v=${CHILD_HOME_BACKGROUND_CACHE_BUST}`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover brightness-[1.1] pointer-events-none select-none"
          style={{ objectPosition: `${anchor.imageObjectPositionX}% 50%` }}
          draggable={false}
          fetchPriority="high"
          loading="eager"
          decoding="async"
        />

        {/* ── L2: 캐릭터 ──────────────────────────────────────────────────── */}
        {characterDisplayH > 0 && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: `${anchor.rugCenterX * 100}%`,
              top: `${anchor.characterFootY * 100}%`,
              /** translate(-50%, -100%): 캐릭터 발 중심을 앵커에 정확히 맞춥니다 */
              transform: 'translate(-50%, -100%)',
            }}
          >
            <CharacterSprite
              character={characterSprite.character}
              frame={characterSprite.frame}
              width={Math.round(characterDisplayH * (characterSprite.width / characterSprite.height))}
              height={characterDisplayH}
              className="select-none"
            />
          </div>
        )}

        {/* ── L3: UI 오버레이 ──────────────────────────────────────────────── */}
        <div className="absolute inset-0 z-20 flex flex-col pointer-events-none">

          {/* ── 상단 영역: 좌(레벨 블록) / 우(나가기 + 아이콘 스택) ──────── */}
          <div
            className="flex justify-between items-start px-4 gap-3"
            style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
          >
            {/*
              좌측: 레벨 스탯 카드(위) + 알람 시계(하단) — 세로로 쌓음
              알람: 반투명 박스 없이 아이콘만, 이전(44px)의 2배 터치·이미지 크기
            */}
            <div className="pointer-events-none min-w-0 flex flex-col items-start gap-2">
              {stats && (
                <ChildLevelStatsCard
                  ref={missionHeartsRef}
                  stats={stats}
                  filledHearts={filledHearts}
                  creditRef={creditBadgeRef}
                  shine={badgeShine}
                />
              )}
              <button
                type="button"
                onClick={() => setClockPopupOpen(true)}
                className="flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center
                           border-0 bg-transparent p-0
                           transition-transform active:scale-90 pointer-events-auto"
                aria-label="시계 팝업 열기"
              >
                <Image
                  src="/assets/img/common/ui/alarm.png"
                  alt="알람"
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain drop-shadow-md"
                />
              </button>
              {/* 별 이펙트 — 크레딧 행 주변(고정 위치)에만 그려짐, 레이아웃 높이 없음 */}
              {badgeShine && creditBadgeRef.current && (
                <BadgeStarBurst badgeRef={creditBadgeRef} />
              )}
            </div>

            {/* 우측: 나가기 버튼(맨 위) + 기능 아이콘 수직 스택 */}
            <div className="flex flex-col items-center gap-2 pointer-events-auto shrink-0">
              {/* 나가기 문 버튼 — 배경 없이 아이콘만, 약간 크게 */}
              <a
                href={exitHref}
                className="w-12 h-12 flex items-center justify-center transition active:scale-95"
                aria-label="나가기"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/img/common/ui/exit.png" alt="" width={36} height={36} className="h-9 w-9 object-contain drop-shadow-md" />
              </a>

              {/* 아이템(꾸미기) 아이콘 — 베타 미노출 */}
              {/* {features.dressUp && (
                <button
                  type="button"
                  onClick={() => setActivePanel('dressup')}
                  className="w-11 h-11 bg-white/40 rounded-2xl flex items-center justify-center shadow-md backdrop-blur-sm transition active:scale-95"
                  aria-label="캐릭터 꾸미기 열기"
                >
                  <img
                    src={`/assets/img/characters/items/background/${encodeURIComponent('items (21).png')}`}
                    alt=""
                    width={30}
                    height={30}
                    className="h-[30px] w-[30px] object-contain"
                  />
                </button>
              )} */}

              {/* 코인 주머니 아이콘 */}
              {features.coinPocket && (
                <button
                  type="button"
                  onClick={() => setActivePanel('coins')}
                  className="w-11 h-11 bg-white/40 rounded-2xl flex items-center justify-center shadow-md backdrop-blur-sm transition active:scale-95"
                  aria-label="내 크레딧 열기"
                >
                  <span className="text-xl" role="img" aria-hidden>💰</span>
                </button>
              )}

            </div>
          </div>

          {/* ── 캐릭터 발 라인 좌우 끝 아이콘 ──────────────────────────── */}
          {/* 오른쪽 끝 아이콘 스택 — 스티커(위) + 마켓(아래), 캐릭터 발 Y보다 약간 위 */}
          <div
            className="absolute right-3 pointer-events-auto flex flex-col items-center gap-2"
            style={{
              top: `${(anchor.characterFootY - 0.12) * 100}%`,
              transform: 'translateY(-50%)',
            }}
          >
            {/* 스티커(하트) — 위 */}
            {features.sticker && (
              <button
                type="button"
                onClick={() => setActivePanel('sticker')}
                className="flex items-center justify-center transition active:scale-95"
                aria-label="칭찬 스티커 판 열기"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/assets/img/items/stickers/${encodeURIComponent('heart (5).png')}`}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain drop-shadow-md"
                />
              </button>
            )}

            {/* 마켓(장바구니) — 아래 */}
            {features.market && (
              <button
                type="button"
                onClick={() => setActivePanel('market')}
                className="mt-1.5 flex items-center justify-center transition active:scale-95"
                aria-label="마켓 열기"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/img/common/ui/basket_filled.png"
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain drop-shadow-md"
                />
              </button>
            )}
          </div>

          {/* ── 스페이서 ────────────────────────────────────────────────── */}
          <div className="flex-1" />

          {/* ── 하단: 미션 섹션 (max-h로 화면 45% 이내로 제한) ─────────── */}
          <div
            className="pointer-events-auto max-h-[45vh] flex flex-col"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            {/* 미션 헤더 — 우측 하트는 상단 배지와 중복되므로 완료 카운트만 표시 */}
            <div className="flex items-center justify-between px-5 mb-2 shrink-0">
              <p className="text-white font-black text-sm drop-shadow">오늘의 미션</p>
              {visibleMissions.length > 0 && (
                <span className="text-white/80 text-xs font-bold drop-shadow">
                  {visibleMissions.filter((dm) => done.has(dm.id)).length}/{visibleMissions.length}
                </span>
              )}
            </div>

            {/* 미션 카드 가로 스크롤 */}
            {visibleMissions.length === 0 ? (
              <div className="px-5">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-5 text-center">
                  <p className="font-bold text-gray-600 text-sm">아직 미션이 없어요</p>
                  <p className="text-xs text-gray-400 mt-1">부모님이 미션을 만들어주실 거예요!</p>
                </div>
              </div>
            ) : incompleteOrdered.length === 0 ? (
              // 전부 완료 시 인라인 배너는 쓰지 않음 — 축하는 AllMissionCompleteOverlay 한 곳에서만 처리
              <div className="px-5 shrink-0" aria-hidden />
            ) : (
              <div
                className="flex flex-row gap-3 overflow-x-auto px-5 pb-3 pt-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {incompleteOrdered.map((mission) => (
                  <ChildMissionCard
                    key={mission.id}
                    mission={mission}
                    onComplete={handleMissionComplete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── L4: 파티클 레이어 — 최상위 z-index, 클릭 통과 ─────────── */}
        {/* 비개발자 설명: 코인/하트가 이 레이어에서 날아다닙니다. */}
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden" aria-hidden>
          {particles.map((p) => (
            <MissionParticle key={p.id} particle={p} />
          ))}
        </div>
      </div>

      {/* ── L5: 패널 오버레이 ─────────────────────────────────────────────── */}
      <ChildPanelOverlay
        active={activePanel}
        onClose={() => setActivePanel(null)}
        childId={childId}
        features={features}
        marketEligibleItems={marketEligibleItems}
        initialHiddenStoreItemIds={initialHiddenStoreItemIds}
        marketRequests={marketRequests}
        initialWishlistEntries={initialWishlistEntries}
        creditsWallet={stats?.credits_wallet ?? 0}
        creditsTotal={totalCredits}
        level={stats?.current_level ?? 0}
        ageYears={ageYears}
        childStats={stats}
        onStatsUpdate={handleStatsUpdate}
        unlockedItemIndexes={initialUnlockedItemIndexes}
        praiseGrants={grants}
        praisePlacements={placements}
        serverPraiseBoardClearedAt={stats?.praise_board_cleared_at ?? null}
        onPraiseBoardCleared={clearPraiseStickerBoard}
        praiseGrantsRevision={praiseGrantsRevision}
        onInventoryChange={refreshStickerPlacements}
      />

      {/* ── L6: 연속 탭 확인 팝업 ─────────────────────────────────────────── */}
      <RapidTapConfirmModal
        open={rapidTapModalOpen}
        onConfirm={handleRapidTapConfirm}
        onDeny={handleRapidTapDeny}
      />

      {showSchoolTime && !isSleeping && !showMorningWake ? (
        <SchoolTimePopup
          childName={childName}
          soundSrc={resolveRoutineAlarmSoundUrl(readRoutineAlarmPrefs().soundSchool)}
          onClose={() => setShowSchoolTime(false)}
        />
      ) : showSleepReady && !isSleeping && !showMorningWake ? (
        <SleepReadyPopup
          childName={childName}
          soundSrc={resolveRoutineAlarmSoundUrl(readRoutineAlarmPrefs().soundSleepReady)}
          onGoMission={() => setShowSleepReady(false)}
          onClose={() => setShowSleepReady(false)}
        />
      ) : null}

      {showCelebration && (
        <AllMissionCompleteOverlay
          todayCredits={todayEarnedCredits}
          childName={childName}
          onSleep={() => {
            setShowCelebration(false)
            setIsSleeping(true)
          }}
        />
      )}

      {isSleeping && !showMorningWake ? (
        <SleepModeScreen
          childName={childName}
          alarmTime={routineWakeAlarmHHMM}
          onWake={() => {
            setIsSleeping(false)
            setShowMorningWake(true)
          }}
        />
      ) : null}

      {showMorningWake ? (
        <MorningWakeScreen childName={childName} onStart={() => setShowMorningWake(false)} />
      ) : null}

      {/*
       * z-[160] 이상인 ChildAlarmClockPopup — DOM 순서상 마지막에 두어도 자체 z-index로 최상위에 뜸
       * 비개발자 설명: 루틴 알람·뽀모도로 시계(부모 LocalStorage 설정 반영)를 여는 별도 창입니다.
       */}
      <ChildAlarmClockPopup open={clockPopupOpen} onClose={() => setClockPopupOpen(false)} />
    </>
  )
}
