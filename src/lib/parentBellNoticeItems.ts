/**
 * 부모 상단 「종」게시판 시트에 보여 줄 공지 목록입니다.
 * - 나중에 서버/API 로 바꿀 때 이 배열만 갈아끼우면 됩니다.
 */

export type ParentBellNoticeItem = {
  id: string
  title: string
  summary: string
  href: string
}

export const PARENT_BELL_NOTICE_ITEMS: ParentBellNoticeItem[] = [
  {
    id: 'notice-routine',
    title: '루틴 알림 점검 안내',
    summary: '루틴 알람 설정을 확인해 주세요.',
    href: '/parent/routine',
  },
  {
    id: 'notice-approval',
    title: '새 승인 요청이 있어요',
    summary: '자녀의 미션 승인 요청을 확인해 주세요.',
    href: '/parent/approval',
  },
  {
    id: 'notice-home',
    title: '이번 주 주요 공지',
    summary: '홈에서 이번 주 공지사항을 확인해 주세요.',
    href: '/parent/home',
  },
  {
    id: 'notice-system',
    title: '시스템 점검 공지',
    summary: '설정 화면에서 점검 일정을 확인할 수 있어요.',
    href: '/settings',
  },
]
