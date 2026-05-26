-- ============================================================
-- 088_child_stats_level_overflow_backfill.sql
-- 레벨 5 고정/경험치 오버플로우(예: 1025/761) 보정
--
-- 비개발자 설명:
-- - 기존 DB 제약 때문에 레벨이 5에서 멈춘 아이가 있을 수 있습니다.
-- - 이 스크립트는 레벨 상한을 넓히고, 이미 넘친 경험치를 기준으로
--   레벨/경험치/다음 레벨 필요 경험치를 다시 계산해 맞춥니다.
-- ============================================================

-- 1) current_level 관련 CHECK 제약을 동적으로 제거(환경별 이름 차이 대응)
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

-- 2) 레벨 상한을 99로 재설정
alter table public.child_stats
  add constraint child_stats_current_level_range_check
  check (current_level >= 0 and current_level <= 99);

comment on column public.child_stats.current_level is '현재 레벨(0~99)';

-- 3) 이미 넘친 경험치를 이용해 레벨/exp/exp_to_next_level 백필
do $$
declare
  r record;
  v_level int;
  v_exp int;
  v_next int;
begin
  for r in
    select id, current_level, exp, exp_to_next_level
    from public.child_stats
  loop
    v_level := greatest(0, coalesce(r.current_level, 0));
    v_exp := greatest(0, coalesce(r.exp, 0));
    v_next := greatest(1, coalesce(r.exp_to_next_level, 100));

    -- 경험치가 다음 레벨 기준을 넘는 동안 반복 레벨업
    while v_level < 99 and v_exp >= v_next loop
      v_exp := v_exp - v_next;
      v_level := v_level + 1;
      v_next := greatest(1, round(v_next * 1.5));
    end loop;

    update public.child_stats
    set
      current_level = v_level,
      exp = v_exp,
      exp_to_next_level = v_next
    where id = r.id;
  end loop;
end $$;
