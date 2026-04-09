-- ============================================================
-- 050_special_mission_titles_coat_after_meal.sql
-- 스페셜 미션 제목 변경: 밥 다먹기 → 식사후 정리, 빨래 정리 → 외투 걸어두기
-- (칩 목록에서 삭제된 항목은 DB 행을 지우지 않음 — 기존 배정·로그 보존)
-- ============================================================

begin;

update public.missions
set
  title = '식사후 정리',
  icon_emoji = '/assets/img/missions/routine/special/clean_up_all.png'
where trim(title) = '밥 다먹기';

update public.missions
set
  title = '외투 걸어두기',
  icon_emoji = '/assets/img/missions/routine/special/hanging_cloth.png'
where trim(title) in ('빨래 정리', '빨래정리');

commit;
