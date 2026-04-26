/**
 * 060_rename_morning_mission_titles.sql
 *
 * 오전 루틴 전역 템플릿 미션의 제목을 칩(routineChips.ts) 정의와 일치시킵니다.
 * - '일어나기' → '기상'  : 칩 id am-wake, 순서 0번(가장 앞)
 * - '양치하기'  → '양치'  : 칩 id am-brush, 순서 2번
 *
 * 이 변경으로 routineMissionFlowRank 가 칩 순위를 적용해
 * 기상 → 세수하기 → 양치 → 아침식사 … 순으로 정렬됩니다.
 *
 * ※ linked_child_id 가 있는 자녀별 미션도 함께 정정합니다.
 *   자녀 화면·부모 설정 모두 동일한 순서로 노출됩니다.
 */

-- 전역 템플릿(linked_child_id IS NULL) 정정
update public.missions
set title = '기상'
where title = '일어나기'
  and block = 'morning';

update public.missions
set title = '양치'
where title = '양치하기'
  and block = 'morning';

-- 자녀별 미션(linked_child_id IS NOT NULL)도 동일하게 정정
update public.missions
set title = '기상'
where title = '일어나기'
  and block = 'morning'
  and linked_child_id is not null;

update public.missions
set title = '양치'
where title = '양치하기'
  and block = 'morning'
  and linked_child_id is not null;
