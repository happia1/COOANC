'use client'

/**
 * 자녀 앱 레이아웃이 서버에서 한 번 읽은 프로필·가족 연결 스냅샷을
 * 클라이언트 트리에 넘깁니다. (탭 전환 시 추가 fetch 없음 — 데이터는 RSC·React cache 가 담당)
 *
 * `enter-child-ui` API 는 부모앱→자녀앱 진입 시에만 쓰이며, 이 Context 와 무관합니다.
 */

import { createContext, useContext, type ReactNode } from 'react'

export type ChildAppFamilyLink = { id: string; parent_id: string }

export type ChildAppProfileValue = {
  /** 미리보기·자녀 본인 모두 `getActorChildContext` 의 actorChildId */
  childId: string
  childName: string
  childAvatarUrl: string | null
  familyLinks: ChildAppFamilyLink[]
}

const ProfileContext = createContext<ChildAppProfileValue | null>(null)

export function ChildAppProfileProvider({
  value,
  children,
}: {
  value: ChildAppProfileValue
  children: ReactNode
}) {
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

/** 자녀 앱 내부 클라이언트 컴포넌트에서만 사용하세요. */
export function useChildAppProfile() {
  return useContext(ProfileContext)
}
