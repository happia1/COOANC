-- ============================================================
-- 119_minigame_claw_machine.sql
-- 인형뽑기(클로우 머신) 미니게임 세션 + 화분 씨앗 인벤토리
-- ============================================================

-- ── 인형뽑기 세션 ──────────────────────────────────────────
create table if not exists public.minigame_sessions (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references public.profiles(id) on delete cascade,
  layout     jsonb not null,
  tries_left int not null default 5 check (tries_left >= 0),
  status     text not null default 'active' check (status in ('active', 'completed')),
  started_at timestamptz not null default now(),
  day_key    text not null
);

comment on table public.minigame_sessions is
  '인형뽑기 미니게임 1세션(보물상자 이용권 1장 소모) — 6칸 상품 배치·남은 시도 수.';
comment on column public.minigame_sessions.layout is
  'jsonb 배열 [{position:0-5, prize:{type,...}}]. 당첨된 칸은 그랩 API에서 배열에서 제거됩니다.';
comment on column public.minigame_sessions.day_key is
  '서울 기준 YYYY-MM-DD — 분석용 메타데이터, 일일 제한 로직 없음.';

create index if not exists minigame_sessions_child_active_idx
  on public.minigame_sessions (child_id, status, started_at desc);

alter table public.minigame_sessions enable row level security;

drop policy if exists "minigame_sessions_child_access" on public.minigame_sessions;
create policy "minigame_sessions_child_access"
  on public.minigame_sessions
  for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = minigame_sessions.child_id
    )
  )
  with check (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = minigame_sessions.child_id
    )
  );

grant select, insert, update on table public.minigame_sessions to authenticated;

-- ── 심지 않은 씨앗(뽑기 보관함) ────────────────────────────
create table if not exists public.plant_seed_inventory (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.profiles(id) on delete cascade,
  tree_id     text not null default 'apple',
  acquired_at timestamptz not null default now(),
  consumed_at timestamptz,
  source      text not null default 'claw_machine'
);

comment on table public.plant_seed_inventory is
  '인형뽑기 등으로 획득했지만 아직 화분에 심지 않은 씨앗. consumed_at is null = 미사용. 심기(소비) 플로우는 별도 작업 범위입니다.';

create index if not exists plant_seed_inventory_child_unconsumed_idx
  on public.plant_seed_inventory (child_id)
  where consumed_at is null;

alter table public.plant_seed_inventory enable row level security;

drop policy if exists "plant_seed_inventory_child_access" on public.plant_seed_inventory;
create policy "plant_seed_inventory_child_access"
  on public.plant_seed_inventory
  for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = plant_seed_inventory.child_id
    )
  )
  with check (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = plant_seed_inventory.child_id
    )
  );

grant select, insert, update on table public.plant_seed_inventory to authenticated;
