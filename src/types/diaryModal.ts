/**
 * DiaryModal — props 타입 (ChildScreen ↔ DiaryModal 계약)
 */

/** ChildScreen 에서 이미 알고 있는 자녀 프로필 스냅샷 */
export type DiaryChildProfile = {
  name: string
  avatarUrl: string
  /** 만 나이(세). 없으면 null */
  ageYears: number | null
  currentLevel: number
}

export type DiaryModalProps = {
  open: boolean
  onClose: () => void
  childId: string
  /** 홈에서 fetch·전달한 프로필 — 모달 안에서 profiles 재조회하지 않음 */
  childProfile: DiaryChildProfile
  /** 보고 있는 일기 날짜 (YYYY-MM-DD). 열 때 보통 오늘(today) */
  initialDate: string
  /** 달력 등에서 날짜를 바꿀 때 */
  onInitialDateChange: (dateKey: string) => void
}
