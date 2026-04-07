-- ============================================================
-- 040: 지갑·저금통 크레딧 분리 + 마켓 위시리스트(장바구니)
-- - credits: 총 보유(기존과 동일). 지갑+저금통에 넣지 않은 나머지 = 섬(가용)으로 화면에서 계산
-- - 마켓 구매는 credits_wallet 에서만 차감 → 미션에서 지갑으로 옮겨야 쓸 수 있음
-- ============================================================

alter table public.child_stats
  add column if not exists credits_wallet int not null default 0,
  add column if not exists credits_piggy int not null default 0;

comment on column public.child_stats.credits_wallet is '마켓 등 「쓸 돈」으로 쓰는 지갑 크레딧';
comment on column public.child_stats.credits_piggy is '저금통에 넣어 둔 크레딧(교육용 분리)';

-- 기존 유저: 전부 지갑으로 두면 이전과 같이 바로 마켓 사용 가능
update public.child_stats
set credits_wallet = credits, credits_piggy = 0
where credits_wallet = 0 and credits_piggy = 0;

alter table public.child_stats
  drop constraint if exists child_stats_credits_split_check;

alter table public.child_stats
  add constraint child_stats_credits_split_check
  check (
    credits_wallet >= 0
    and credits_piggy >= 0
    and credits_wallet + credits_piggy <= credits
  );

-- ── 위시리스트(장바구니): 자녀별 상품 id ─────────────────────
create table if not exists public.market_wishlist_items (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles(id) on delete cascade,
  store_item_id uuid not null references public.store_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (child_id, store_item_id)
);

create index if not exists idx_market_wishlist_child
  on public.market_wishlist_items (child_id, created_at desc);

alter table public.market_wishlist_items enable row level security;

create policy "market_wishlist_child_own"
  on public.market_wishlist_items for all
  using (auth.uid() = child_id)
  with check (auth.uid() = child_id);

create policy "market_wishlist_parent_linked"
  on public.market_wishlist_items for all
  using (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = market_wishlist_items.child_id
    )
  )
  with check (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.child_id = market_wishlist_items.child_id
    )
  );
