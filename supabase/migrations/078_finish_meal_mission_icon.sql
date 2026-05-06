-- ============================================================
-- 078_finish_meal_mission_icon.sql
-- 「밥 다 먹기」계열 및 레거시 밥그릇비우기(같은 칩) → clean_up_all.png
-- ============================================================

begin;

update public.missions
set icon_emoji = '/assets/img/missions/routine/special/clean_up_all.png'
where regexp_replace(btrim(title), '\s', '', 'g') = '밥다먹기';

update public.missions
set icon_emoji = '/assets/img/missions/routine/special/clean_up_all.png'
where btrim(title) in ('밥그릇비우기', '밥그릇 비우기');

commit;

notify pgrst, 'reload schema';
