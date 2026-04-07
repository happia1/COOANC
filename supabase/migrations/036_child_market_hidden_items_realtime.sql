-- 자녀 마켓이 부모의 메뉴 표시/숨김을 새로고침 없이 받도록 Realtime 발행에 포함합니다.
-- (이미 등록된 DB 에서는 건너뜁니다.)

do $body$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'child_market_hidden_items'
  ) then
    alter publication supabase_realtime add table public.child_market_hidden_items;
  end if;
end
$body$;
