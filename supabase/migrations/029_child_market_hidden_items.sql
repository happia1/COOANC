-- 자녀별 마켓 상품 숨김(부모가 승인 탭에서 토글)
-- 행이 있으면 해당 상품은 자녀 마켓 목록에서 제외됩니다. 행이 없으면 표시(기본).

create table if not exists public.child_market_hidden_items (
  child_id uuid not null references public.profiles (id) on delete cascade,
  store_item_id uuid not null references public.store_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (child_id, store_item_id)
);

comment on table public.child_market_hidden_items is
  '부모가 자녀 마켓에서 숨긴 상품. PK 행 존재 = 자녀 화면에 비표시.';

alter table public.child_market_hidden_items enable row level security;

-- 자녀: 본인 행만 조회 (마켓 필터용)
create policy "child_market_hidden_items_child_select"
  on public.child_market_hidden_items
  for select
  using (auth.uid() = child_id);

-- 부모: 연결된 자녀에 대해 숨김 목록 조회·추가·삭제
create policy "child_market_hidden_items_parent_all"
  on public.child_market_hidden_items
  for all
  using (
    exists (
      select 1
      from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = child_market_hidden_items.child_id
    )
  )
  with check (
    exists (
      select 1
      from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = child_market_hidden_items.child_id
    )
  );

create index if not exists idx_child_market_hidden_items_child
  on public.child_market_hidden_items (child_id);
