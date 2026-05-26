-- ============================================================
-- 087_child_stats_level_cap_extend.sql
-- 레벨 상한(0~5) 제거: 레벨 6 이상도 정상 저장되게 보정
--
-- 문제:
-- - 기존 child_stats CHECK가 current_level 0~5로 고정되어
--   앱에서 레벨 6+를 저장하려 해도 DB가 거절했습니다.
-- - 결과적으로 레벨 5 이후 진행이 멈춘 것처럼 보일 수 있습니다.
--
-- 조치:
-- 1) current_level 관련 CHECK 제약을 동적으로 제거
-- 2) 상한을 99로 넓힌 새 CHECK 추가
-- ============================================================

do $$
declare
  con record;
begin
  for con in
    select c.conname::text as conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'child_stats'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%current_level%'
  loop
    execute format('alter table public.child_stats drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.child_stats
  add constraint child_stats_current_level_range_check
  check (current_level >= 0 and current_level <= 99);

comment on column public.child_stats.current_level is '현재 레벨(0~99)';
