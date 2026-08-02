-- ============================================================
-- 133_content_channel_orders.sql
-- 자녀별 콘텐츠 채널 표시 순서를 저장합니다. (090 의 마켓 순서 테이블과 같은 구조)
-- 비개발자 요약:
-- - 부모가 「콘텐츠 관리」에서 카드를 길게 눌러 옮긴 순서를 child_id 단위로 저장합니다.
-- - 행이 없으면 기존 정렬(content_channels.order_index)을 그대로 씁니다.
-- - 자녀별로 따로 저장하므로, 한 가족이 순서를 바꿔도 다른 가족에는 영향이 없습니다.
-- ============================================================

create table if not exists public.content_channel_orders (
  child_id   uuid not null references public.profiles (id) on delete cascade,
  channel_id uuid not null references public.content_channels (id) on delete cascade,
  order_rank int not null check (order_rank >= 0 and order_rank <= 1000000),
  updated_at timestamptz not null default now(),
  primary key (child_id, channel_id)
);

create index if not exists content_channel_orders_channel_idx
  on public.content_channel_orders (channel_id);

create index if not exists content_channel_orders_child_rank_idx
  on public.content_channel_orders (child_id, order_rank);

comment on table public.content_channel_orders is
  '부모 「콘텐츠 관리」에서 자녀별 콘텐츠 채널 노출 순서를 저장합니다.';

alter table public.content_channel_orders enable row level security;

grant select, insert, update, delete
  on public.content_channel_orders
  to authenticated;

-- 자녀 본인: 자신의 순서 조회만 허용
drop policy if exists "content_channel_orders_child_select" on public.content_channel_orders;
create policy "content_channel_orders_child_select"
  on public.content_channel_orders
  for select
  using (auth.uid() = child_id);

-- 연결된 부모: 해당 자녀 순서 조회/추가/수정/삭제
drop policy if exists "content_channel_orders_parent_select" on public.content_channel_orders;
create policy "content_channel_orders_parent_select"
  on public.content_channel_orders
  for select
  using (
    exists (
      select 1 from public.family_links fl
      where fl.child_id = content_channel_orders.child_id and fl.parent_id = auth.uid()
    )
  );

drop policy if exists "content_channel_orders_parent_insert" on public.content_channel_orders;
create policy "content_channel_orders_parent_insert"
  on public.content_channel_orders
  for insert
  with check (
    exists (
      select 1 from public.family_links fl
      where fl.child_id = content_channel_orders.child_id and fl.parent_id = auth.uid()
    )
  );

drop policy if exists "content_channel_orders_parent_update" on public.content_channel_orders;
create policy "content_channel_orders_parent_update"
  on public.content_channel_orders
  for update
  using (
    exists (
      select 1 from public.family_links fl
      where fl.child_id = content_channel_orders.child_id and fl.parent_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.family_links fl
      where fl.child_id = content_channel_orders.child_id and fl.parent_id = auth.uid()
    )
  );

drop policy if exists "content_channel_orders_parent_delete" on public.content_channel_orders;
create policy "content_channel_orders_parent_delete"
  on public.content_channel_orders
  for delete
  using (
    exists (
      select 1 from public.family_links fl
      where fl.child_id = content_channel_orders.child_id and fl.parent_id = auth.uid()
    )
  );
