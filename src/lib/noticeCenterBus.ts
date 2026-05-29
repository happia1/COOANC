/**
 * 공지센터(부모 "알림·공지" 보드)를 다른 컴포넌트에서 "열어 달라"고 부탁하는 작은 이벤트 버스입니다.
 *
 * 비개발자 설명:
 * - 앱 실행 팝업과 공지센터(종 아이콘 보드)는 화면에서 서로 멀리 떨어진 별개의 부품이에요.
 * - 팝업의 "더 보기"를 눌렀을 때 공지센터를 열고 그 공지를 펼쳐 보여 주려면, 둘을 이어 줄 신호가 필요합니다.
 * - 그래서 브라우저 전역(window)에 "공지센터 열어줘"라는 신호(이벤트)를 쏘고,
 *   공지센터를 가진 부품이 그 신호를 듣고 스스로 열리도록 했습니다. (서로 직접 연결하지 않아 코드가 단순해져요.)
 */

/** 공지센터 열기 신호의 이름 */
export const OPEN_NOTICE_CENTER_EVENT = 'cooanc:open-notice-center'

/** 신호와 함께 전달되는 정보 — 펼쳐서 보여 줄 공지 id(없으면 그냥 보드만 엽니다) */
export type OpenNoticeCenterDetail = {
  noticeId: string | null
}

/**
 * 공지센터를 열어 달라고 신호를 보냅니다.
 * @param noticeId 펼쳐서 보여 줄 공지 id (생략하면 보드만 열림)
 */
export function openNoticeCenter(noticeId?: string | null) {
  if (typeof window === 'undefined') return
  const detail: OpenNoticeCenterDetail = { noticeId: noticeId ?? null }
  window.dispatchEvent(new CustomEvent(OPEN_NOTICE_CENTER_EVENT, { detail }))
}
