-- ============================================================
-- 049_routine_mission_icon_title_fix.sql
-- 루틴/스페셜 미션 제목과 icon_emoji(썸네일 PNG 경로) 불일치 수정
-- (046 시드에서 저녁식사→책 PNG, 밥먹고 정리→설거지 PNG 가 잘못 연결됨)
-- ============================================================

begin;

update public.missions
set icon_emoji = '🍽️'
where title = '저녁식사'
  and (
    icon_emoji like '%/book.png'
    or icon_emoji like '%/p.m/book.png'
  );

update public.missions
set icon_emoji = '/assets/img/missions/routine/special/clean_up_all.png'
where title = '밥먹고 정리하기'
  and icon_emoji = '/assets/img/missions/routine/special/put_away_dishes.png';

commit;
