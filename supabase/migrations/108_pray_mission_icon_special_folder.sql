-- ============================================================
-- 108_pray_mission_icon_special_folder.sql
-- 「기도하기」일러스트 — p.m/pray.png 는 없고 special/pray.png 만 존재
-- ============================================================

begin;

update public.missions
set icon_emoji = '/assets/img/missions/routine/special/pray.png'
where regexp_replace(btrim(title), '\s', '', 'g') in ('기도', '기도하기')
   or icon_emoji like '%/p.m/pray.png';

commit;

notify pgrst, 'reload schema';
