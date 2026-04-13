-- ============================================================
-- 055_remove_retired_routine_keyword_missions.sql
-- UI에서 제거한 일상 키워드(퍼즐놀이·미술놀이·잠자리 세수) 템플릿을 DB에서 삭제합니다.
-- - 평일(daily)·주말·휴일(weekly) 루틴에 남아 있던 행이 그대로 보이던 문제를 막습니다.
-- - 자녀에 연결된(linked_child_id) 일상 템플릿만 대상입니다.
-- - daily_missions·mission_logs 는 missions 삭제 시 FK CASCADE 로 정리됩니다(026·048).
-- ============================================================

begin;

delete from public.missions m
where m.linked_child_id is not null
  and m.repeat_type in ('daily', 'weekly')
  and trim(m.title) in ('퍼즐놀이', '미술놀이', '잠자리 세수');

commit;

notify pgrst, 'reload schema';
