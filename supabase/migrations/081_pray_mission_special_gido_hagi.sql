-- ============================================================
-- 081_pray_mission_special_gido_hagi.sql
-- 「기도하기」를 스페셜 미션으로 고정 — 「기도」옛 제목·전역/자녀 연결 행 모두 통일
-- ============================================================

begin;

update public.missions
set
  title = '기도하기',
  difficulty = 'special',
  icon_emoji = '/assets/img/missions/routine/p.m/pray.png'
where trim(title) in ('기도', '기도하기');

commit;

notify pgrst, 'reload schema';
