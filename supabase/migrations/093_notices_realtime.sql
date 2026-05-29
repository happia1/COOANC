-- ============================================================
-- 093_notices_realtime.sql
-- 공지(notices) 변경을 새로고침 없이 즉시 받도록 Realtime 발행에 포함합니다.
--
-- 비개발자 요약:
-- - 관리자가 Supabase Table Editor 에서 공지를 추가/수정/삭제하면,
--   부모 앱의 공지 화면이 열려 있는 동안 곧바로 반영됩니다.
-- - 이미 등록된 DB 에서는 건너뜁니다(여러 번 실행해도 안전).
-- ============================================================

do $body$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notices'
  ) then
    alter publication supabase_realtime add table public.notices;
  end if;
end
$body$;
