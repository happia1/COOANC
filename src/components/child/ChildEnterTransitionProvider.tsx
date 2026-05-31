'use client'

/**
 * 부모↔자녀 화면 전환 시 루트에 유지되는 오버레이 상태입니다.
 * 라우트가 바뀌어도 깜빡임 없이 한 장의 로딩 화면만 보여 줍니다.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import ChildAppTransitionOverlay from '@/components/child/ChildAppTransitionOverlay'

type OverlayMode = 'child-enter' | 'parent-exit' | null

type Ctx = {
  childEnterActive: boolean
  parentExitActive: boolean
  beginChildEnter: () => void
  endChildEnter: () => void
  beginParentExit: () => void
  endParentExit: () => void
}

const noop = () => {}

const fallbackCtx: Ctx = {
  childEnterActive: false,
  parentExitActive: false,
  beginChildEnter: noop,
  endChildEnter: noop,
  beginParentExit: noop,
  endParentExit: noop,
}

const AppTransitionContext = createContext<Ctx | null>(null)

const CHILD_ENTER_MESSAGE = '자녀 화면을 불러오는 중…'
const PARENT_EXIT_MESSAGE = '부모 화면으로 이동 중…'

export function ChildEnterTransitionProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<OverlayMode>(null)

  const beginChildEnter = useCallback(() => setOverlay('child-enter'), [])
  const endChildEnter = useCallback(
    () => setOverlay((prev) => (prev === 'child-enter' ? null : prev)),
    [],
  )
  const beginParentExit = useCallback(() => setOverlay('parent-exit'), [])
  const endParentExit = useCallback(
    () => setOverlay((prev) => (prev === 'parent-exit' ? null : prev)),
    [],
  )

  const value = useMemo(
    (): Ctx => ({
      childEnterActive: overlay === 'child-enter',
      parentExitActive: overlay === 'parent-exit',
      beginChildEnter,
      endChildEnter,
      beginParentExit,
      endParentExit,
    }),
    [overlay, beginChildEnter, endChildEnter, beginParentExit, endParentExit],
  )

  return (
    <AppTransitionContext.Provider value={value}>
      {overlay === 'child-enter' ? (
        <ChildAppTransitionOverlay statusMessage={CHILD_ENTER_MESSAGE} background="child" />
      ) : null}
      {overlay === 'parent-exit' ? (
        <ChildAppTransitionOverlay statusMessage={PARENT_EXIT_MESSAGE} background="parent" />
      ) : null}
      {children}
    </AppTransitionContext.Provider>
  )
}

/** Provider 밖·HMR 중에도 throw 하지 않습니다 */
export function useChildEnterTransition(): Ctx {
  return useContext(AppTransitionContext) ?? fallbackCtx
}

/** @deprecated 이름 호환 — `useChildEnterTransition` 과 동일 */
export const useAppTransition = useChildEnterTransition
