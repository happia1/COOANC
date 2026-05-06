-- ============================================================
-- 082_dinner_mission_rename_to_evening_meal.sql
-- 저녁 루틴 식사 카드 통일:
-- - 구 제목 「저녁식사」 → 「저녁밥먹기」
-- - icon_emoji 를 전용 PNG(`/assets/img/missions/routine/p.m/dinner.png`)로 통일
-- ============================================================

begin;

update public.missions
set
  title = '저녁밥먹기',
  icon_emoji = '/assets/img/missions/routine/p.m/dinner.png'
where trim(title) = '저녁식사';

update public.missions
set icon_emoji = '/assets/img/missions/routine/p.m/dinner.png'
where trim(title) = '저녁밥먹기'
  and icon_emoji is distinct from '/assets/img/missions/routine/p.m/dinner.png';

commit;

notify pgrst, 'reload schema';

