-- ============================================================
-- 068_daily_missions_realtime.sql
-- 자녀 앱이 부모 「다시하기」(롤백) 직후 카드·팝업을 즉시 맞추도록
-- daily_missions 행 변경을 Supabase Realtime 으로 구독할 수 있게 합니다.
-- (015_realtime.sql 에는 mission_logs / purchase_requests / child_stats 만 있었음)
-- ============================================================

do $body$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'daily_missions'
  ) then
    alter publication supabase_realtime add table public.daily_missions;
  end if;
end
$body$;
