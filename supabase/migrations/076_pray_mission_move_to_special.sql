-- ============================================================
-- 076_pray_mission_move_to_special.sql
-- 「기도」를 일상 템플릿에서 스페셜(difficulty: special)로 전환
-- ============================================================

begin;

update public.missions
set difficulty = 'special'
where trim(title) = '기도'
  and linked_child_id is not null
  and difficulty is distinct from 'special';

commit;

notify pgrst, 'reload schema';
