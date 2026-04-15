/**
 * 부모 앱 `app/parent/layout` → `ParentAppChrome` 의 `<main>` 에 붙이는 id 입니다.
 * - 메인 영역이 `overflow-y-auto` 로 스크롤되며, 그 **스크롤 막대**가 포털 오버레이(예: 루틴 도우미)보다 위에 그려지는 경우가 있어
 *   챗봇을 열 때 이 요소의 overflow 를 잠글 때 querySelector 로 찾습니다.
 */
export const PARENT_TABS_MAIN_SCROLL_EL_ID = 'parent-tabs-main-scroll' as const
