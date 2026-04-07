'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import SpriteFromAtlas from '@/components/child/SpriteFromAtlas'
import { useShopAnimationsAtlas } from '@/components/child/useShopAnimationsAtlas'
import PraiseUiIcon from '@/components/common/PraiseUiIcon'
import { praiseAssetStickerUrl } from '@/lib/praiseAssetStickers'
import { praiseUiKindFromSpriteKey } from '@/lib/praiseStickerUi'
import { STICKER_BOARD_FRAME_KEY, type AnimationsAtlasFile } from '@/lib/shopAnimationsAtlas'
import {
  BEAR_BOARD_ASPECT,
  BEAR_GRID_COLS,
  BEAR_GRID_ROWS,
  BEAR_GRID_ZONE,
  BEAR_PAPER_ZONE,
  slotCenterPercent,
} from '@/lib/bearBoardLayout'
import type { PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'
import { mergePraiseStickerGrantsFromServer } from '@/lib/mergePraiseStickerGrantsFromServer'
import { createClient } from '@/lib/supabase/client'
import PraiseGiftConfetti from '@/components/child/PraiseGiftConfetti'
import BearBoardCompleteModal from '@/components/child/BearBoardCompleteModal'

const TITLE_ID = 'bear-sticker-sheet-title'
const SLOT_TOTAL = 20
/** 드래그 중 빈 칸에 더 넓게 끌어당김(자석), 놓을 때는 좁은 값으로 확정 */
const DROP_RADIUS_SCALE = 1
const MAGNET_RADIUS_SCALE = 1.45
/** 종이 위 스티커 두 개 중심이 이 값(보드 전체 기준 %)보다 가까우면 겹친다고 보고 다시 뽑습니다 */
const MIN_FLOAT_STICKER_SEP_PCT = 9

/**
 * grant id 를 0~1 두 실수로 바꿉니다. 랜덤이 잘 안 될 때도 건마다 다른 대체 좌표를 쓰기 위함입니다.
 */
function spreadFromGrantId(id: string): { u: number; v: number } {
  const hex = id.replace(/-/g, '')
  const u = parseInt(hex.slice(0, 8), 16) / 0xffffffff
  const v = parseInt(hex.slice(8, 16), 16) / 0xffffffff
  return { u, v }
}

/**
 * 아틀라스의 sticker_board.png 한 장을 컨테이너에 맞게 꽉 채웁니다(캡처 PNG 대신 JSON 좌표로 파싱).
 * 로딩 전에는 연한 회색만 깔아 두어, 예전처럼 하늘색 큰 카드가 보이지 않게 합니다.
 */
function BearBoardFromAtlas({ atlas }: { atlas: AnimationsAtlasFile | null }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const apply = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setDim({ w: r.width, h: r.height })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
      {atlas && dim.w > 0 && dim.h > 0 ? (
        <SpriteFromAtlas
          atlas={atlas}
          frameKey={STICKER_BOARD_FRAME_KEY}
          width={dim.w}
          height={dim.h}
          className="pointer-events-none absolute left-0 top-0 select-none"
          label="곰돌이 스티커 판"
        />
      ) : (
        <div className="h-full w-full bg-neutral-200/40" aria-hidden />
      )}
    </div>
  )
}

function GrantStickerThumb({
  spriteKey,
  w,
  atlas,
  plain,
}: {
  spriteKey: string
  w: number
  atlas: AnimationsAtlasFile | null
  /** UI 스티커일 때 배경 박스 없이 그림만 */
  plain?: boolean
}) {
  /** PNG 폴더 스티커(asset:…)는 스프라이트 시트가 아니라 단일 이미지로 그립니다 */
  const assetSrc = praiseAssetStickerUrl(spriteKey)
  if (assetSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 작은 썸네일, 동적 키 다수
      <img
        src={assetSrc}
        alt=""
        width={w}
        height={w}
        className={`object-contain ${plain ? '' : 'rounded-md bg-white/90 p-0.5 shadow-sm'}`}
        style={{ width: w, height: w }}
      />
    )
  }
  const ui = praiseUiKindFromSpriteKey(spriteKey)
  if (ui) return <PraiseUiIcon kind={ui} size={w} plain={plain} />
  return <SpriteFromAtlas atlas={atlas} frameKey={spriteKey} width={w} height={w} label={spriteKey} />
}

type Props = {
  open: boolean
  onClose: () => void
  childId: string
  initialGrants: PraiseStickerGrant[]
  initialPlacements: PraiseStickerPlacement[]
  onInventoryChange?: () => void
  /**
   * 서버에서 판을 비운 뒤 부모 `placements` 도 즉시 [] 로 맞춰야 합니다.
   * 그렇지 않으면 `initialPlacements` 가 옛 데이터로 남아 effect 가 스티커를 다시 채웁니다.
   */
  onBoardCleared?: () => void
}

/**
 * 곰돌이 스티커 판 — 화면 중앙 팝업(바텀시트 아님)
 * - 스티커 보드 일러스트만 두드러지게, 카드/진행바 등 추가 배경 최소화
 * - 종이 구역에 받은 스티커를 드래그해 1~20번 칸에 놓으면 저장
 * - 바깥 어둡게 한 영역 또는 우상단 × 로 닫기
 */
export default function BearStickerSheet({
  open,
  onClose,
  childId,
  initialGrants,
  initialPlacements,
  onInventoryChange,
  onBoardCleared,
}: Props) {
  const { atlas } = useShopAnimationsAtlas()
  const [grants, setGrants] = useState(initialGrants)
  const [placements, setPlacements] = useState(initialPlacements)
  const [floatPos, setFloatPos] = useState<Record<string, { x: number; y: number }>>({})
  const [placing, setPlacing] = useState(false)
  /** 드래그 중 자석으로 당겨지는 빈 슬롯(시각 강조) */
  const [magneticPreviewSlot, setMagneticPreviewSlot] = useState<number | null>(null)
  const [boardCompleteModalOpen, setBoardCompleteModalOpen] = useState(false)
  const [boardCompleteConfetti, setBoardCompleteConfetti] = useState(false)
  /** 닫힐 때 짧은 페이드아웃 후 언마운트(바텀시트 대신 중앙 팝업용) */
  const [overlayMounted, setOverlayMounted] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  /**
   * 판을 비운 시각(ISO 문자열). 이 시각 이전에 지급된 스티커는 종이 위 미배치 목록에서 숨깁니다.
   * - 20칸 완주 후 자동으로 판을 비운 뒤에도 grant 행은 DB에 남으므로, 숨기지 않으면 종이에 예전 스티커가 다시 가득 보입니다.
   * - 새로 부모가 지급한 스티커는 created_at 이 더 뒤라서 그대로 보입니다.
   */
  const [lastBoardClearedAt, setLastBoardClearedAt] = useState<string | null>(null)

  /**
   * 부모 앱 `parent_sticker_board:${childId}` 채널로 브로드캐스트를 보낼 때 씁니다.
   * 미션 탭의 `parent_mission_log_refresh` 와 같은 패턴으로, 시트가 열린 뒤 구독이 완료되면 ref 가 채워집니다.
   */
  const parentStickerBoardBroadcastRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(
    null,
  )

  /** 드래그 중인 grant id (포인터는 window 에서 추적) */
  const dragRef = useRef<{
    grantId: string
    startX: number
    startY: number
    origX: number
    origY: number
    el: HTMLElement
    pointerId: number
  } | null>(null)

  /** 스티커 좌표(%)는 이 박스(종횡비 보드) 기준이어야 함 — 바깥 래퍼와 크기가 다르면 드롭·위치가 틀어짐 */
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setGrants((prev) => mergePraiseStickerGrantsFromServer(initialGrants, prev))
  }, [initialGrants])

  useEffect(() => {
    setPlacements(initialPlacements)
  }, [initialPlacements])

  /** 시트를 열 때마다 sessionStorage 에서 "판 비움" 시각을 읽어, 새로고침 후에도 이전 사이클 스티커를 숨깁니다 */
  useEffect(() => {
    if (!open) return
    try {
      const k = `praise_board_cleared_at:${childId}`
      const v = sessionStorage.getItem(k)
      setLastBoardClearedAt(v)
    } catch {
      /* 비공개 모드 등에서 sessionStorage 가 막혀 있으면 무시 */
    }
  }, [open, childId])

  const placedGrantIds = useMemo(() => new Set(placements.map((p) => p.grant_id)), [placements])
  /** grant 목록에 실제로 존재하는 id 집합 — 칸 썸네일용(고아 배치는 tag.png 로 표시) */
  const grantIdSet = useMemo(() => new Set(grants.map((g) => g.id)), [grants])

  const unplacedGrants = useMemo(
    () =>
      grants.filter((g) => {
        if (placedGrantIds.has(g.id)) return false
        if (lastBoardClearedAt != null && g.created_at <= lastBoardClearedAt) return false
        return true
      }),
    [grants, placedGrantIds, lastBoardClearedAt],
  )

  /**
   * 종이 위 좌표 effect 의존성은 항상 같은 개수·순서여야 합니다.
   * 배열(unplacedGrants 등)을 그대로 deps 에 넣거나 실수로 스프레드하면 길이가 바뀌어 React 가 오류를 냅니다.
   */
  const paperFloatLayoutKey = useMemo(() => {
    const grantPart = unplacedGrants
      .map((g) => g.id)
      .slice()
      .sort()
      .join(',')
    const placePart = placements
      .map((p) => `${p.grant_id}:${p.board_slot ?? 'n'}`)
      .slice()
      .sort()
      .join(';')
    return `${grantPart}#${placePart}`
  }, [unplacedGrants, placements])

  /**
   * DB 에 placement 행이 있으면 칸은 점유로 봅니다.
   * 예전에 grant 행이 없어진 "고아" 배치만 빼면 클라는 빈 칸인데 서버는 유니크 제약으로 막혀 붙지 않는 현상이 납니다.
   */
  const occupiedSlots = useMemo(() => {
    const s = new Set<number>()
    for (const p of placements) {
      if (p.board_slot != null && p.board_slot >= 1 && p.board_slot <= SLOT_TOTAL) s.add(p.board_slot)
    }
    return s
  }, [placements])

  const cw = BEAR_GRID_ZONE.width / BEAR_GRID_COLS
  const ch = BEAR_GRID_ZONE.height / BEAR_GRID_ROWS
  const slotHitSize = Math.min(cw, ch) * 0.72

  useEffect(() => {
    if (open) {
      setOverlayMounted(true)
      const id = requestAnimationFrame(() => setOverlayVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setOverlayVisible(false)
    const t = window.setTimeout(() => setOverlayMounted(false), 220)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!overlayMounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [overlayMounted])

  useEffect(() => {
    if (!open) {
      setMagneticPreviewSlot(null)
      setBoardCompleteConfetti(false)
    }
  }, [open])

  /**
   * 판 비우기 직후 타임스탬프를 저장합니다. sessionStorage 에 넣어 같은 탭에서 시트를 다시 열어도 유지됩니다.
   */
  const bumpBoardCycle = useCallback(() => {
    const ts = new Date().toISOString()
    try {
      sessionStorage.setItem(`praise_board_cleared_at:${childId}`, ts)
    } catch {
      /* noop */
    }
    setLastBoardClearedAt(ts)
  }, [childId])

  useEffect(() => {
    if (!boardCompleteConfetti) return
    const t = window.setTimeout(() => setBoardCompleteConfetti(false), 5200)
    return () => window.clearTimeout(t)
  }, [boardCompleteConfetti])

  /**
   * 스티커 시트가 열려 있을 때만 부모 알림용 브로드캐스트 채널을 붙입니다.
   * 닫으면 채널을 끊어 불필요한 연결을 줄입니다.
   */
  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    const ch = supabase.channel(`parent_sticker_board:${childId}`, { config: { broadcast: { ack: false } } })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') parentStickerBoardBroadcastRef.current = ch
    })
    return () => {
      parentStickerBoardBroadcastRef.current = null
      void supabase.removeChannel(ch)
    }
  }, [open, childId])

  /**
   * 「엄마에게 알려주기」: 같은 이름의 채널을 구독 중인 부모 화면에 이벤트를 쏩니다.
   * 시트를 막 연 직후라 아직 `SUBSCRIBED` 가 안 됐을 수 있어, ref 가 비면 임시 채널로 한 번 더 보냅니다.
   */
  const notifyParentStickerBoardComplete = useCallback(() => {
    const payload = { type: 'broadcast' as const, event: 'sticker_board_filled', payload: { t: Date.now() } }
    const ch = parentStickerBoardBroadcastRef.current
    if (ch) {
      void ch.send(payload)
      return
    }
    const supabase = createClient()
    const once = supabase.channel(`parent_sticker_board:${childId}`, { config: { broadcast: { ack: false } } })
    once.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      void once.send(payload)
      void supabase.removeChannel(once)
    })
  }, [childId])

  /**
   * 종이 위 미배치 스티커 시작 위치
   * - 예전: unplaced 목록에서의 인덱스 i 로만 찍어서, 선물이 하나씩만 쌓일 때마다 i=0 → 항상 같은 점
   * - 지금: BEAR_PAPER_ZONE 안에서 랜덤 + 이미 칸에 붙은 슬롯 중심·다른 플로팅 스티커와 최소 거리 유지
   */
  useEffect(() => {
    if (!open) return
    setFloatPos((prev) => {
      const next: Record<string, { x: number; y: number }> = { ...prev }
      for (const id of Object.keys(next)) {
        if (!unplacedGrants.some((g) => g.id === id)) delete next[id]
      }

      const slotCenters: { x: number; y: number }[] = []
      for (const p of placements) {
        if (p.board_slot == null) continue
        const c = slotCenterPercent(p.board_slot)
        if (c) slotCenters.push(c)
      }

      const { left, top, width, height } = BEAR_PAPER_ZONE
      const padX = width * 0.1
      const padY = height * 0.12
      const xMin = left + padX
      const yMin = top + padY
      const xSpan = Math.max(width - 2 * padX, 0.02)
      const ySpan = Math.max(height - 2 * padY, 0.02)

      const farFromAll = (x: number, y: number, pts: { x: number; y: number }[]) =>
        pts.every((p) => Math.hypot(x - p.x, y - p.y) >= MIN_FLOAT_STICKER_SEP_PCT)

      /** 이미 판에 붙은 칸 + 종이 위에서 이미 자리 잡은 스티커 — 새 좌표는 이들과 떨어져야 함 */
      let avoidPoints: { x: number; y: number }[] = [...slotCenters]

      for (const g of unplacedGrants) {
        const existing = next[g.id]
        if (existing != null) {
          avoidPoints.push(existing)
          continue
        }

        let chosen: { x: number; y: number } | null = null
        for (let attempt = 0; attempt < 56; attempt++) {
          const x = xMin + Math.random() * xSpan
          const y = yMin + Math.random() * ySpan
          if (farFromAll(x, y, avoidPoints)) {
            chosen = { x, y }
            break
          }
        }

        if (!chosen) {
          const { u, v } = spreadFromGrantId(g.id)
          chosen = { x: xMin + u * xSpan, y: yMin + v * ySpan }
          for (let step = 0; step < 16 && !farFromAll(chosen.x, chosen.y, avoidPoints); step++) {
            chosen = {
              x: xMin + ((u + step * 0.09) % 1) * xSpan,
              y: yMin + ((v + step * 0.13) % 1) * ySpan,
            }
          }
        }

        next[g.id] = chosen
        avoidPoints.push(chosen)
      }

      return next
    })
  }, [open, paperFloatLayoutKey])

  const grantSpriteKey = useCallback(
    (grantId: string) => grants.find((g) => g.id === grantId)?.sprite_key ?? 'tag.png',
    [grants],
  )

  /**
   * 슬롯 판정은 보드 픽셀 기준 거리로 합니다(가로·세로 %를 섞은 hypot 은 세로로 긴 보드에서 착시가 납니다).
   * 스티커 중심과 포인터(손가락) 중 더 가까운 쪽으로 거리를 재어, 1번처럼 모서리 칸도 놓치지 않게 합니다.
   */
  const nearestFreeSlotAtPixels = useCallback(
    (
      stickerCenterX: number,
      stickerCenterY: number,
      pointerX: number,
      pointerY: number,
      radiusScale: number,
    ): number | null => {
      const br = boardRef.current?.getBoundingClientRect()
      if (!br || br.width <= 0 || br.height <= 0) return null
      const cwPct = BEAR_GRID_ZONE.width / BEAR_GRID_COLS
      const chPct = BEAR_GRID_ZONE.height / BEAR_GRID_ROWS
      const cellWpx = (cwPct / 100) * br.width
      const cellHpx = (chPct / 100) * br.height
      const hitPx = Math.min(cellWpx, cellHpx) * 0.52 * radiusScale
      let best: { slot: number; d: number } | null = null
      for (let slot = 1; slot <= SLOT_TOTAL; slot++) {
        if (occupiedSlots.has(slot)) continue
        const c = slotCenterPercent(slot)
        if (!c) continue
        const cx = br.left + (c.x / 100) * br.width
        const cy = br.top + (c.y / 100) * br.height
        const dStick = Math.hypot(stickerCenterX - cx, stickerCenterY - cy)
        const dPtr = Math.hypot(pointerX - cx, pointerY - cy)
        const d = Math.min(dStick, dPtr)
        if (d <= hitPx && (!best || d < best.d)) best = { slot, d }
      }
      return best?.slot ?? null
    },
    [occupiedSlots],
  )

  /**
   * 숫자 칸에 붙이기 — 브라우저에서 Supabase 직접 insert 시 부모 미리보기 세션은 RLS 에 걸립니다.
   * 서버 API 가 family_links·지급 행을 검증한 뒤 service_role(또는 자녀 RLS)로 저장합니다.
   */
  const placeOnSlot = useCallback(
    async (grantId: string, slot: number) => {
      if (occupiedSlots.has(slot) || placing) return
      const c = slotCenterPercent(slot)
      if (!c) return
      setPlacing(true)
      let data: PraiseStickerPlacement | null = null
      try {
        const res = await fetch('/api/praise-sticker/place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId,
            grantId,
            boardSlot: slot,
            xRatio: c.x / 100,
            yRatio: c.y / 100,
            scaleRatio: 1,
          }),
        })
        const json = (await res.json()) as { placement?: PraiseStickerPlacement; error?: string }
        if (!res.ok) {
          console.error('[bear sticker slot]', json.error ?? res.statusText)
          setPlacing(false)
          return
        }
        if (json.placement) data = json.placement
      } catch (e) {
        console.error('[bear sticker slot]', e instanceof Error ? e.message : String(e))
      }
      setPlacing(false)
      if (data) {
        const wasOneAwayFromFull = occupiedSlots.size === SLOT_TOTAL - 1
        setPlacements((prev) => [...prev, data as PraiseStickerPlacement])
        setFloatPos((prev) => {
          const n = { ...prev }
          delete n[grantId]
          return n
        })
        if (wasOneAwayFromFull) {
          setBoardCompleteConfetti(true)
          setBoardCompleteModalOpen(true)
          try {
            const resetRes = await fetch('/api/praise-sticker/reset-board', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ childId }),
            })
            if (!resetRes.ok) {
              const resetJson = (await resetRes.json().catch(() => ({}))) as { error?: string }
              console.error('[bear sticker reset]', resetJson.error ?? resetRes.statusText)
            } else {
              setPlacements([])
              /** 부모 state 를 먼저 비워야 `initialPlacements` effect 가 옛 행을 다시 넣지 않음 */
              onBoardCleared?.()
              /** 종이 위 예전 지급 스티커도 숨기고, sessionStorage 에 사이클 시각을 남깁니다 */
              bumpBoardCycle()
              /** 리셋 직후 Supabase 재조회는 가끔 삭제 전 스냅샷을 주어 덮어쓸 수 있어 호출하지 않음 */
            }
          } catch (e) {
            console.error('[bear sticker reset]', e instanceof Error ? e.message : String(e))
          }
        } else {
          onInventoryChange?.()
        }
      }
    },
    [childId, occupiedSlots, placing, onBoardCleared, onInventoryChange, bumpBoardCycle],
  )

  // dragRef 는 state 가 아니라서 변경돼도 effect 가 다시 안 돕니다. 리스너는 항상 달고, 핸들러 안에서만 dragRef 를 검사합니다.
  useEffect(() => {
    if (!open) return

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const br = boardRef.current?.getBoundingClientRect()
      if (!br || br.width <= 0 || br.height <= 0) return
      const dx = ((e.clientX - d.startX) / br.width) * 100
      const dy = ((e.clientY - d.startY) / br.height) * 100
      const cxPct = d.origX + dx
      const cyPct = d.origY + dy
      const stickerCenterX = br.left + (cxPct / 100) * br.width
      const stickerCenterY = br.top + (cyPct / 100) * br.height
      const slotMag = nearestFreeSlotAtPixels(
        stickerCenterX,
        stickerCenterY,
        e.clientX,
        e.clientY,
        MAGNET_RADIUS_SCALE,
      )
      setMagneticPreviewSlot(slotMag)
      if (slotMag != null) {
        const c = slotCenterPercent(slotMag)
        if (c) {
          setFloatPos((prev) => ({
            ...prev,
            [d.grantId]: { x: c.x, y: c.y },
          }))
          return
        }
      }
      setFloatPos((prev) => ({
        ...prev,
        [d.grantId]: { x: cxPct, y: cyPct },
      }))
    }

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current
      dragRef.current = null
      if (!d) return
      try {
        if (d.el.hasPointerCapture(d.pointerId)) d.el.releasePointerCapture(d.pointerId)
      } catch {
        /* noop */
      }
      const br = boardRef.current?.getBoundingClientRect()
      if (!br || br.width <= 0 || br.height <= 0) {
        setFloatPos((prev) => ({
          ...prev,
          [d.grantId]: { x: d.origX, y: d.origY },
        }))
        return
      }
      const dx = ((e.clientX - d.startX) / br.width) * 100
      const dy = ((e.clientY - d.startY) / br.height) * 100
      const cxPct = d.origX + dx
      const cyPct = d.origY + dy
      setMagneticPreviewSlot(null)
      const stickerCenterX = br.left + (cxPct / 100) * br.width
      const stickerCenterY = br.top + (cyPct / 100) * br.height
      const slot = nearestFreeSlotAtPixels(
        stickerCenterX,
        stickerCenterY,
        e.clientX,
        e.clientY,
        DROP_RADIUS_SCALE,
      )
      if (slot != null) void placeOnSlot(d.grantId, slot)
      else
        setFloatPos((prev) => ({
          ...prev,
          [d.grantId]: { x: d.origX, y: d.origY },
        }))
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [open, nearestFreeSlotAtPixels, placeOnSlot])

  const onStickerPointerDown = useCallback(
    (e: React.PointerEvent, grantId: string) => {
      if (placing) return
      const pos = floatPos[grantId]
      if (!pos) return
      e.preventDefault()
      e.stopPropagation()
      setMagneticPreviewSlot(null)
      const el = e.currentTarget as HTMLElement
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* 일부 브라우저에서 실패해도 window 리스너로 이동은 됨 */
      }
      dragRef.current = {
        grantId,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
        el,
        pointerId: e.pointerId,
      }
    },
    [floatPos, placing],
  )

  return (
    <>
      {overlayMounted ? (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
        role="dialog"
        aria-modal
        aria-labelledby={TITLE_ID}
      >
        {/* 반투명 딤: 스티커판만 돋보이게, 카드형 하늘 배경은 쓰지 않음 */}
        <button
          type="button"
          className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ease-out ${
            overlayVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onClose}
          aria-label="닫기"
        />

        <div
          className={`relative z-10 w-full max-w-md transition-opacity duration-200 ease-out ${
            overlayVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <h2 id={TITLE_ID} className="sr-only">
            곰돌이 스티커 판
          </h2>
          {/* 추가 패널 배경 없음 — 아틀라스 스티커판 이미지가 전부 */}
          <div
            ref={boardRef}
            className="relative mx-auto w-full max-h-[min(88vh,820px)] overflow-hidden rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
            style={{ aspectRatio: BEAR_BOARD_ASPECT }}
          >
            {/* 보드 그림 위 우측 상단 닫기(별도 카드 없이 팝업만) */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2 top-2 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/90 text-lg font-light leading-none text-gray-800 shadow-md backdrop-blur-[2px] transition hover:bg-white active:scale-95"
              aria-label="닫기"
            >
              <span aria-hidden>×</span>
            </button>
            <BearBoardFromAtlas atlas={atlas} />

            {/* 1~20 드롭 영역(투명, 약한 테두리 — 터치는 넉넉한 원) */}
            {Array.from({ length: SLOT_TOTAL }, (_, i) => i + 1).map((slot) => {
              const c = slotCenterPercent(slot)
              if (!c) return null
              const taken = occupiedSlots.has(slot)
              const magnetHere = !taken && magneticPreviewSlot === slot
              return (
                <div
                  key={slot}
                  className={`absolute z-[5] rounded-full border border-dashed transition-all duration-150 ${
                    taken
                      ? 'border-transparent'
                      : magnetHere
                        ? 'border-brand-yellow bg-brand-yellow/25 shadow-[0_0_12px_rgba(250,204,21,0.55)] ring-2 ring-brand-yellow/80'
                        : 'border-white/25 bg-white/5'
                  }`}
                  style={{
                    left: `${c.x}%`,
                    top: `${c.y}%`,
                    width: `${slotHitSize}%`,
                    aspectRatio: '1',
                    transform: 'translate(-50%, -50%)',
                  }}
                  aria-hidden
                />
              )
            })}

            {placements.map((p) => {
              if (p.board_slot == null) return null
              const c = slotCenterPercent(p.board_slot)
              if (!c) return null
              /** grant 가 목록에 없으면(고아 배치) 기본 아이콘으로라도 칸이 막혀 있음을 보여 줍니다 */
              const sk = grantIdSet.has(p.grant_id) ? grantSpriteKey(p.grant_id) : 'tag.png'
              return (
                <div
                  key={p.id}
                  className="pointer-events-none absolute z-[15]"
                  style={{
                    left: `${c.x}%`,
                    top: `${c.y}%`,
                    /** 요청사항: 스티커를 조금 아래로 보이게 보정 */
                    transform: 'translate(-50%, -44%)',
                  }}
                >
                  {/* 요청사항: 스티커 크기를 약간 축소 */}
                  <GrantStickerThumb spriteKey={sk} w={34} atlas={atlas} plain />
                </div>
              )
            })}

            {unplacedGrants.map((g) => {
              const pos = floatPos[g.id]
              if (!pos) return null
              return (
                <button
                  key={g.id}
                  type="button"
                  className="absolute z-[20] cursor-grab touch-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onPointerDown={(e) => onStickerPointerDown(e, g.id)}
                  aria-label="스티커를 드래그해 숫자 칸에 놓기"
                >
                  <GrantStickerThumb spriteKey={g.sprite_key} w={44} atlas={atlas} plain />
                </button>
              )
            })}
          </div>
        </div>
      </div>
      ) : null}

    <PraiseGiftConfetti active={boardCompleteConfetti} />
    <BearBoardCompleteModal
      open={boardCompleteModalOpen}
      onDismiss={() => setBoardCompleteModalOpen(false)}
      onNotifyParent={notifyParentStickerBoardComplete}
    />
    </>
  )
}
