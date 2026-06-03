-- ============================================================
-- 110_homework_study_mission_title.sql
-- 「숙제하기」 → 「숙제·공부하기」 (일상·스페셜 공통 표기)
-- ============================================================

begin;

update public.missions
set title = '숙제·공부하기'
where btrim(title) = '숙제하기';

commit;

notify pgrst, 'reload schema';
