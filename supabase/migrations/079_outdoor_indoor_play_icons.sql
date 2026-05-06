-- ============================================================
-- 079_outdoor_indoor_play_icons.sql
-- 「야외놀이」·「실외놀이」·「바깥놀이」→ paly_outside.png
-- 「실내놀이」→ play_inside.png
-- (공백만 다른 제목도 동일 파일로 맞춤)
-- ============================================================

begin;

update public.missions
set icon_emoji = '/assets/img/missions/routine/p.m/paly_outside.png'
where regexp_replace(btrim(title), '\s', '', 'g') in ('야외놀이', '실외놀이', '바깥놀이');

update public.missions
set icon_emoji = '/assets/img/missions/routine/p.m/play_inside.png'
where regexp_replace(btrim(title), '\s', '', 'g') = '실내놀이';

commit;

notify pgrst, 'reload schema';
