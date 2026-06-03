/**
 * 일상 미션 제목 정규화 — 정렬·키워드 시트·썸네일 매칭이 같은 규칙을 쓰도록 분리했습니다.
 * (`routineChips` 가 `routineMissionThumbnail` 을 쓰므로, 역방향 import 시 순환 참조가 납니다.)
 */

/** 구버전 제목 → 현재 칩 제목 (블록별 규칙은 아래 함수 참고) */
export const MISSION_TITLE_ALIASES: Record<string, string> = {
  일어나기: '기상',
  양치하기: '양치',
  /** 구 버전 미션 제목 — 칩 제목 「잘 시간」 과 동일한 슬롯으로 취급합니다. */
  취침: '잘 시간',
  /** 저녁 루틴 카드 이름 통일 */
  저녁식사: '저녁밥먹기',
  /** 구 DB/시드 — 칩·정렬 키는 "세수하기" 로 통일 */
  세수: '세수하기',
  /** 구버전 일상·스페셜 제목 */
  숙제하기: '숙제·공부하기',
  /** 「샤워하기」와 내용이 겹쳐 칩에서 제거 — 저장된 옛 제목은 샤워 칩과 같은 그림·순위로 맞춥니다 */
  '목욕/샤워': '샤워하기',
}

/**
 * DB 에 저장된 제목·블록을 「키워드 칩 제목」으로 바꿉니다.
 * - 오후 블록의 「물마시기」만 「저녁 물마시기」로 구분합니다.
 */
export function canonicalRoutineChipMatchTitle(m: { title: string; block?: string | null }): string {
  const raw = m.title.trim()
  let title = MISSION_TITLE_ALIASES[raw] ?? raw
  if (title === '물마시기' && m.block && m.block !== 'morning') return '저녁 물마시기'
  return title
}
