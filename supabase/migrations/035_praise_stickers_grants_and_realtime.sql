-- 칭찬 스티커: authenticated 역할에 테이블 권한이 없으면 RLS를 만족해도 INSERT 가 거절될 수 있습니다.
-- 또한 033 마이그레이션의 realtime add 가 이미 적용된 DB 에서는 재실행 시 실패할 수 있어 idempotent 하게 보완합니다.

grant select, insert on table public.praise_sticker_grants to authenticated;
grant select, insert, update on table public.praise_sticker_placements to authenticated;

do $body$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'praise_sticker_grants'
  ) then
    alter publication supabase_realtime add table public.praise_sticker_grants;
  end if;
end
$body$;
