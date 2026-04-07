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

  const placedGrantIds = useMemo(() => new Set(placements.map((p) => p.grant_id)), [placements])

  const unplacedGrants = useMemo(
    () => grants.filter((g) => !placedGrantIds.has(g.id)),
    [grants, placedGrantIds],
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

  const occupiedSlots = useMemo(() => {
    const s = new Set<number>()
    for (const p of placements) {
      if (p.board_slot != null && p.board_slot >= 1 && p.board_slot <= SLOT_TOTAL) s.add(p.board_slot)
    }
    return s
  }, [placements])

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

  useEffect(() => {
    if (!boardCompleteConfetti) return
    const t = window.setTimeout(() => setBoardCompleteConfetti(false), 5200)
    return () => window.clearTimeout(t)
  }, [boardCompleteConfetti])

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
        onInventoryChange?.()
        if (wasOneAwayFromFull) {
          setBoardCompleteConfetti(true)
          setBoardCompleteModalOpen(true)
        }
      }
    },
    [childId, occupiedSlots, placing, onInventoryChange],
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

  const cw = BEAR_GRID_ZONE.width / BEAR_GRID_COLS
  const ch = BEAR_GRID_ZONE.height / BEAR_GRID_ROWS
  const slotHitSize = Math.min(cw, ch) * 0.72

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
              const sk = grantSpriteKey(p.grant_id)
              return (
                <div
                  key={p.id}
                  className="pointer-events-none absolute z-[15]"
                  style={{
                    left: `${c.x}%`,
                    top: `${c.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <GrantStickerThumb spriteKey={sk} w={38} atlas={atlas} plain />
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
      onGoMarket={onClose}
    />
    </>
  )
}
