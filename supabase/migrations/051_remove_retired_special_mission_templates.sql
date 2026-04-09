-- ============================================================
-- 051_remove_retired_special_mission_templates.sql
-- 스페셜 칩에서 빠진 미션(설거지·방청소·심부름·골고루먹기) 템플릿을 DB에서 제거합니다.
-- - 자녀에 연결된(linked_child_id) 스페셜·이벤트 템플릿만 대상(공용 풀 행은 건드리지 않음)
-- - daily_missions·mission_logs 는 missions 삭제 시 FK CASCADE 로 함께 정리됩니다(026·048)
-- ============================================================

begin;

delete from public.missions m
where m.linked_child_id is not null
  and (
    (m.difficulty = 'special' and m.repeat_type = 'daily')
    or m.repeat_type = 'event'
  )
  and trim(m.title) in (
    '설거지',
    '방청소',
    '심부름',
    '심부름하기',
    '방 청소하기',
    '골고루먹기'
  );

commit;

notify pgrst, 'reload schema';
