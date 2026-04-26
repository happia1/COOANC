/**
 * 컨테이너 크기 추적 훅
 *
 * 비개발자 설명:
 * - 특정 HTML 요소(div 등)의 가로/세로 크기를 실시간으로 추적합니다.
 * - 화면 크기가 바뀌거나 레이아웃이 변경될 때마다 자동으로 업데이트됩니다.
 * - 캐릭터를 배경 높이의 38%로 그리는 계산에 사용합니다.
 */

import { type RefObject, useEffect, useState } from 'react'

export type ContainerSize = {
  width: number
  height: number
}

/**
 * ref 로 가리킨 요소의 contentRect(실제 콘텐츠 영역) 크기를 반환합니다.
 * ResizeObserver 로 크기 변경을 감지하므로 화면 회전·창 크기 변경에도 즉시 반응합니다.
 *
 * @param ref 크기를 추적할 HTML 요소의 ref
 * @returns { width, height } — 초기값은 { width: 0, height: 0 }
 */
export function useContainerSize(ref: RefObject<HTMLElement | null>): ContainerSize {
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 })

  useEffect(() => {
    if (!ref.current) return

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })

    ro.observe(ref.current)

    return () => ro.disconnect()
  }, [ref])

  return size
}
