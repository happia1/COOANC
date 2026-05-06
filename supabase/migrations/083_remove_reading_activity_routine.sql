-- ============================================================
-- 083_remove_reading_activity_routine.sql
-- 일상(키워드) 미션에서 「독서활동」 제거:
-- - 키워드 칩에서 빠졌으므로, 기존 자녀 연결(daily/weekly) 템플릿 행도 삭제해 카드가 남지 않게 합니다.
-- ============================================================

begin;

delete from public.missions
where linked_child_id is not null
  and difficulty is distinct from 'special'
  and repeat_type in ('daily', 'weekly')
  and regexp_replace(btrim(title), '\s', '', 'g') = '독서활동';

commit;

notify pgrst, 'reload schema';

