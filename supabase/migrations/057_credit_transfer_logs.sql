-- ============================================================
-- 057_credit_transfer_logs.sql
-- 지갑·저금통·돈바구니(가용) 간 크레딧 이동 이력 (감사 로그)
-- 앱 API가 이체 성공 후 한 줄씩 적재합니다.
-- ============================================================

create table if not exists public.credit_transfer_logs (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references public.profiles (id) on delete cascade,
  from_bucket     text not null check (from_bucket in ('basket', 'piggy', 'wallet')),
  to_bucket       text not null check (to_bucket in ('basket', 'piggy', 'wallet')),
  amount          integer not null check (amount > 0),
  transferred_at  timestamptz not null default now()
);

comment on table public.credit_transfer_logs is
  '크레딧 바구니(basket=가용)·지갑·저금통 사이 이동 기록. 총 credits 변동 없음.';

create index if not exists idx_credit_transfer_child_date
  on public.credit_transfer_logs (child_id, transferred_at desc);

alter table public.credit_transfer_logs enable row level security;

-- 자녀 본인: 전부 (조회·삭제 등 포함)
create policy "child_own"
  on public.credit_transfer_logs
  for all
  using (child_id = auth.uid())
  with check (child_id = auth.uid());

-- 연결된 부모: 자녀 로그 조회만
create policy "parent_read"
  on public.credit_transfer_logs
  for select
  using (
    exists (
      select 1
      from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = credit_transfer_logs.child_id
    )
  );

-- 부모 세션에서도 이체 API가 로그를 남길 수 있도록 INSERT 허용 (자녀 세션은 child_own으로 처리)
create policy "parent_linked_insert"
  on public.credit_transfer_logs
  for insert
  with check (
    exists (
      select 1
      from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = credit_transfer_logs.child_id
    )
  );

grant select, insert on table public.credit_transfer_logs to authenticated;
