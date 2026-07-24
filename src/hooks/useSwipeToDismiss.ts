'use client'

/**
 * 슬라이드/바텀시트 팝업을 손가락 스와이프로 닫기 위한 훅.
 *
 * 비개발자 설명: 팝업 위쪽의 손잡이(또는 헤더)를 잡고 아래(모바일 바텀시트) 또는
 * 옆(태블릿 우측 패널)으로 밀면 팝업이 닫힙니다. 조금만 밀고 놓으면 제자리로 돌아옵니다.
 *
 * 사용법:
 *   const swipe = useSwipeToDismiss(onClose)               // 위/아래·좌/우 모두
 *   const swipe = useSwipeToDismiss(onClose, { axis: 'y' }) // 아래로만
 *   <div style={swipe.dragStyle}>              // 패널 전체에 드래그 이동 적용
 *     <div {...swipe.handleProps}>손잡이·헤더</div>   // 여기서만 스와이프 감지(본문 스크롤과 충돌 방지)
 *   </div>
 *
 * 주의: 본문(overflow-y-auto)이 아니라 **헤더/손잡이**에만 handleProps 를 붙여야
 * 시트 내부 스크롤과 스와이프가 충돌하지 않습니다.
 */

import { useRef, useState, type CSSProperties, type TouchEvent } from 'react'

type Axis = 'y' | 'x' | 'both'

interface Options {
  /** 'y'=아래로만, 'x'=오른쪽으로만, 'both'=지배 축 자동(기본) */
  axis?: Axis
  /** 이 거리(px) 이상 밀면 닫힘 (기본 80) */
  threshold?: number
}

interface SwipeHandleProps {
  onTouchStart: (e: TouchEvent) => void
  onTouchMove: (e: TouchEvent) => void
  onTouchEnd: () => void
}

export function useSwipeToDismiss(
  onClose: () => void,
  opts?: Options,
): { handleProps: SwipeHandleProps; dragStyle: CSSProperties; dragging: boolean } {
  const axis: Axis = opts?.axis ?? 'both'
  const threshold = opts?.threshold ?? 80
  const start = useRef<{ x: number; y: number } | null>(null)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0]
    if (!t) return
    start.current = { x: t.clientX, y: t.clientY }
    setDragging(true)
  }

  function onTouchMove(e: TouchEvent) {
    if (!start.current) return
    const t = e.touches[0]
    if (!t) return
    let dx = t.clientX - start.current.x
    let dy = t.clientY - start.current.y
    // 닫는 방향(아래·오른쪽)만 손가락을 따라가게 합니다.
    if (axis === 'y') {
      dx = 0
      dy = Math.max(0, dy)
    } else if (axis === 'x') {
      dy = 0
      dx = Math.max(0, dx)
    } else if (Math.abs(dy) >= Math.abs(dx)) {
      dx = 0
      dy = Math.max(0, dy)
    } else {
      dy = 0
      dx = Math.max(0, dx)
    }
    setOffset({ x: dx, y: dy })
  }

  function onTouchEnd() {
    const { x, y } = offset
    const passed = Math.abs(y) >= threshold || Math.abs(x) >= threshold
    start.current = null
    setDragging(false)
    if (passed) {
      onClose()
    } else {
      setOffset({ x: 0, y: 0 })
    }
  }

  const dragStyle: CSSProperties =
    offset.x || offset.y
      ? {
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          // 미는 동안엔 전환 없이 손가락을 따라가고, 놓으면 클래스 전환으로 제자리 복귀
          transition: dragging ? 'none' : undefined,
        }
      : {}

  return { handleProps: { onTouchStart, onTouchMove, onTouchEnd }, dragStyle, dragging }
}
