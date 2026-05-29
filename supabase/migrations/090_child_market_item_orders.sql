-- ============================================================
-- 090_child_market_item_orders.sql
-- 자녀별 마켓 상품 표시 순서를 저장합니다.
-- 비개발자 요약:
-- - 부모가 메뉴 제어에서 드래그로 바꾼 순서를 child_id 단위로 저장합니다.
-- - 행이 없으면 기존 정렬 규칙(기본 정렬)을 사용합니다.
-- ============================================================

create table if not exists public.child_market_item_orders (
  child_id      uuid not null references public.profiles (id) on delete cascade,
  store_item_id uuid not null references public.store_items (id) on delete cascade,
  order_rank    int not null check (order_rank >= 0 and order_rank <= 1000000),
  updated_at    timestamptz not null default now(),
  primary key (child_id, store_item_id)
);

create index if not exists child_market_item_orders_store_item_idx
  on public.child_market_item_orders (store_item_id);

create index if not exists child_market_item_orders_child_rank_idx
  on public.child_market_item_orders (child_id, order_rank);

comment on table public.child_market_item_orders is
  '부모 메뉴 제어에서 자녀별 마켓 상품 노출 순서를 저장합니다.';

alter table public.child_market_item_orders enable row level security;

grant select, insert, update, delete
  on public.child_market_item_orders
  to authenticated;

-- 자녀 본인: 자신의 순서 조회만 허용
create policy "child_market_item_orders_child_select"
  on public.child_market_item_orders
  for select
  using (auth.uid() = child_id);

-- 연결된 부모: 해당 자녀 순서 조회/수정
create policy "child_market_item_orders_parent_select"
  on public.child_market_item_orders
  for select
  using (
    exists (
      select 1
      from public.family_links fl
      where fl.child_id = child_market_item_orders.child_id
        and fl.parent_id = auth.uid()
    )
  );

create policy "child_market_item_orders_parent_insert"
  on public.child_market_item_orders
  for insert
  with check (
    exists (
      select 1
      from public.family_links fl
      where fl.child_id = child_market_item_orders.child_id
        and fl.parent_id = auth.uid()
    )
  );

create policy "child_market_item_orders_parent_update"
  on public.child_market_item_orders
  for update
  using (
    exists (
      select 1
      from public.family_links fl
      where fl.child_id = child_market_item_orders.child_id
        and fl.parent_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.family_links fl
      where fl.child_id = child_market_item_orders.child_id
        and fl.parent_id = auth.uid()
    )
  );

create policy "child_market_item_orders_parent_delete"
  on public.child_market_item_orders
  for delete
  using (
    exists (
      select 1
      from public.family_links fl
      where fl.child_id = child_market_item_orders.child_id
        and fl.parent_id = auth.uid()
    )
  );
