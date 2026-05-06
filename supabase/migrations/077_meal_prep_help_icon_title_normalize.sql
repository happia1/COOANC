-- ============================================================
-- 077_meal_prep_help_icon_title_normalize.sql
-- 「식사 준비 돕기」계열 — 공백만 다른 제목도 같은 PNG 로 고정
-- (클라이언트에서도 공백 제거 후 매칭하지만, DB icon_emoji 가 이모지·구경로면 보조)
-- ============================================================

begin;

update public.missions
set icon_emoji = '/assets/img/missions/routine/special/put_cutrary.png'
where regexp_replace(btrim(title), '\s', '', 'g') ~ '^식사준비(돕기|하기)?$';

commit;

notify pgrst, 'reload schema';
