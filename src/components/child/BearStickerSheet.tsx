'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ChildBottomSheetShell from '@/components/child/ChildBottomSheetShell'
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

/**
 * 아틀라스의 sticker_board.png 한 장을 컨테이너에 맞게 꽉 채웁니다(캡처 PNG 대신 JSON 좌표로 파싱).
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
        <div className="h-full w-full bg-sky-200/50" aria-hidden />
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
 * 곰돌이 스티커 판 전체 팝업
 * - 상단 문구·탭 없음, 일러스트를 크게 표시
 * - 종이 구역에 받은 스티커가 떠 있고, 드래그해 숫자 칸(1~20)에 놓으면 저장
 * - 하단 「나가기」로 닫기
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

  const occupiedSlots = useMemo(() => {
    const s = new Set<number>()
    for (const p of placements) {
      if (p.board_slot != null && p.board_slot >= 1 && p.board_slot <= SLOT_TOTAL) s.add(p.board_slot)
    }
    return s
  }, [placements])

  const filledSlotCount = occupiedSlots.size

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

  /** 종이 안 기본 위치(미배치 스티커) */
  useEffect(() => {
    if (!open) return
    setFloatPos((prev) => {
      const next: Record<string, { x: number; y: number }> = { ...prev }
      unplacedGrants.forEach((g, i) => {
        if (next[g.id] == null) {
          const { left, top, width, height } = BEAR_PAPER_ZONE
          const cols = 3
          const col = i % cols
          const row = Math.floor(i / cols)
          // 종이 안 중앙~약간 아래에 겹치지 않게 배치
          next[g.id] = {
            x: left + width * (0.28 + col * 0.22),
            y: top + height * (0.35 + row * 0.28),
          }
        }
      })
      for (const id of Object.keys(next)) {
        if (!unplacedGrants.some((g) => g.id === id)) delete next[id]
      }
      return next
    })
  }, [open, unplacedGrants])

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

  const placeOnSlot = useCallback(
    async (grantId: string, slot: number) => {
      if (occupiedSlots.has(slot) || placing) return
      const c = slotCenterPercent(slot)
      if (!c) return
      setPlacing(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('praise_sticker_placements')
        .insert({
          grant_id: grantId,
          child_id: childId,
          board_slot: slot,
          x_ratio: c.x / 100,
          y_ratio: c.y / 100,
          scale_ratio: 1,
        })
        .select('id, grant_id, child_id, x_ratio, y_ratio, scale_ratio, board_slot, created_at')
        .single()

      setPlacing(false)
      if (error) {
        console.error('[bear sticker slot]', error.message)
        return
      }
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
    <ChildBottomSheetShell open={open} onClose={onClose} titleId={TITLE_ID} compact>
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-3 pt-1">
        <h2 id={TITLE_ID} className="sr-only">
          곰돌이 스티커 판
        </h2>

        <div className="relative mx-auto w-full max-w-md flex-1 overflow-hidden rounded-2xl bg-sky-100/40">
          <div
            ref={boardRef}
            className="relative mx-auto w-full max-h-[78vh]"
            style={{ aspectRatio: BEAR_BOARD_ASPECT }}
          >
            <BearBoardFromAtlas atlas={atlas} />

            {/* 1~20 드롭 영역(투명, 약한 테두리로 위치 가늠 — 터치는 넉넉한 원) */}
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

            {/* 슬롯에 붙은 스티커 */}
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

            {/* 종이 위 플로팅 스티커 */}
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

        <div
          className="mt-2 flex flex-col gap-1 px-1"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-center justify-between text-xs font-bold text-gray-600">
            <span>스티커 판 진행</span>
            <span className="tabular-nums text-brand-blue">
              {filledSlotCount}/{SLOT_TOTAL}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-white/60 ring-1 ring-gray-200/80"
            role="progressbar"
            aria-valuenow={filledSlotCount}
            aria-valuemin={0}
            aria-valuemax={SLOT_TOTAL}
            aria-label={`숫자 칸에 붙인 스티커 ${filledSlotCount}개, 비어 있는 칸 ${SLOT_TOTAL - filledSlotCount}개`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-brand-blue transition-all duration-300"
              style={{ width: `${(filledSlotCount / SLOT_TOTAL) * 100}%` }}
            />
          </div>
          <p className="text-[10px] leading-tight text-gray-500">
            1~{SLOT_TOTAL}번 빈 칸 위로 가져가면 자석처럼 붙어요. 이미 붙은 칸에는 놓을 수 없어요.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full shrink-0 rounded-2xl border-2 border-gray-200 bg-white py-3.5 text-sm font-bold text-gray-600 shadow-sm transition active:scale-[0.99]"
        >
          나가기
        </button>
      </div>
    </ChildBottomSheetShell>

    <PraiseGiftConfetti active={boardCompleteConfetti} />
    <BearBoardCompleteModal
      open={boardCompleteModalOpen}
      onDismiss={() => setBoardCompleteModalOpen(false)}
      onGoMarket={onClose}
    />
    </>
  )
}
