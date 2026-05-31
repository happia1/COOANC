'use client'

/**
 * 부모 → 자녀 진입 시 화면 전체를 덮는 오버레이 상태입니다.
 * 루트 레이아웃에 두어 라우트가 바뀌어도 깜빡임 없이 유지됩니다.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import ChildAppTransitionOverlay from '@/components/child/ChildAppTransitionOverlay'

type Ctx = {
  active: boolean
  beginChildEnter: () => void
  endChildEnter: () => void
}

const ChildEnterTransitionContext = createContext<Ctx | null>(null)

const ENTER_STATUS_MESSAGE = '자녀 화면을 불러오는 중…'

export function ChildEnterTransitionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)

  const beginChildEnter = useCallback(() => {
    setActive(true)
    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '65823a' },
      body: JSON.stringify({
        sessionId: '65823a',
        location: 'ChildEnterTransitionProvider:begin',
        message: 'child enter overlay on',
        data: {},
        hypothesisId: 'parent-child-flicker',
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [])

  const endChildEnter = useCallback(() => {
    setActive(false)
    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '65823a' },
      body: JSON.stringify({
        sessionId: '65823a',
        location: 'ChildEnterTransitionProvider:end',
        message: 'child enter overlay off',
        data: {},
        hypothesisId: 'parent-child-flicker',
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [])

  const value = useMemo(
    () => ({ active, beginChildEnter, endChildEnter }),
    [active, beginChildEnter, endChildEnter],
  )

  return (
    <ChildEnterTransitionContext.Provider value={value}>
      {active ? (
        <ChildAppTransitionOverlay statusMessage={ENTER_STATUS_MESSAGE} background="child" />
      ) : null}
      {children}
    </ChildEnterTransitionContext.Provider>
  )
}

export function useChildEnterTransition(): Ctx {
  const ctx = useContext(ChildEnterTransitionContext)
  if (!ctx) {
    throw new Error('useChildEnterTransition must be used within ChildEnterTransitionProvider')
  }
  return ctx
}
