-- ============================================================
-- 111_plant_seed_credits.sql
-- 씨앗 구매 이력 + pot_stage 0~7 제약 정합(083과 중복 실행 안전)
-- ============================================================

-- pot_stage 0~7 (083 미적용 환경 대비)
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
      and pg_get_constraintdef(c.oid) ilike '%pot_stage%'
  loop
    execute format('alter table public.child_stats drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.child_stats
  drop constraint if exists child_stats_pot_stage_range_check;

alter table public.child_stats
  add constraint child_stats_pot_stage_range_check
  check (pot_stage >= 0 and pot_stage <= 7);

comment on column public.child_stats.pot_stage is '화분 성장 단계 0~7 (씨앗~다 익은 열매)';
comment on column public.child_stats.pot_tree_id is '심은 나무 종류 코드 (apple, strawberry, …)';

-- 씨앗 구매 이력 (분석·감사용)
create table if not exists public.plant_seed_purchases (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles(id) on delete cascade,
  tree_id text not null,
  credit_cost int not null check (credit_cost >= 0),
  purchased_at timestamptz not null default now()
);

create index if not exists plant_seed_purchases_child_id_idx
  on public.plant_seed_purchases (child_id, purchased_at desc);

alter table public.plant_seed_purchases enable row level security;

drop policy if exists "child_own_purchases" on public.plant_seed_purchases;
create policy "child_own_purchases"
  on public.plant_seed_purchases
  for all
  to authenticated
  using (child_id = auth.uid())
  with check (child_id = auth.uid());

grant select, insert on public.plant_seed_purchases to authenticated;
