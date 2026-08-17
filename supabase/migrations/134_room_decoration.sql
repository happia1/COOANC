-- ============================================================
-- 134_room_decoration.sql — 방꾸미기(자녀 캐릭터 팝업 「방꾸미기」 탭)
--
-- 비개발자 설명:
--   아이가 크레딧으로 벽지·바닥·러그를 사서 방을 꾸미고,
--   모빌·액자 같은 「기능형 소품」을 사서 홈 화면에 놓을 수 있게 하는 기능입니다.
--
-- 표 네 개로 나눈 이유:
--   room_items            = 상점에 뭐가 있는지(카탈로그). 모든 아이가 공유합니다.
--   child_room_inventory  = 그 아이가 무엇을 샀는지(보유)
--   child_room_layout     = 배경·바닥·러그처럼 **한 종류에 하나만** 입히는 것
--   child_room_placements = 소품처럼 **각각 따로 켜고 끄는** 것
--
-- 시드 데이터는 전부 is_active=false 로 넣습니다.
-- 이름·가격·레벨은 임시값이며, 실제 그림과 기획이 확정되면 교체할 예정입니다.
-- 화면에는 is_active=true 인 것만 나오므로, 켜기 전까지는 아무 영향이 없습니다.
-- ============================================================

-- ── 카탈로그 ────────────────────────────────────────────────
create table if not exists public.room_items (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  /** background(배경) · floor(바닥) · rug(러그) · furniture(가구) · prop(소품) */
  category       text not null check (category in ('background','floor','rug','furniture','prop')),
  /** 배경일 때만 씁니다 — 실내/야외 구분 */
  scene_type     text check (scene_type in ('indoor','outdoor')),
  /**
   * 가구·소품이 홈 화면 어디에 놓이는지 가리키는 이름표.
   * 자유 배치가 아니라 **미리 정해 둔 자리**에만 놓입니다.
   * 화면 위치는 `src/constants/roomFixedSlots.ts` 에서 이 값으로 찾습니다.
   */
  fixed_slot_key text,
  /** 이 레벨부터 살 수 있습니다. null 이면 아직 기획 미확정 */
  unlock_level   int,
  /** 가격(크레딧). null 이면 아직 기획 미확정 */
  price_credits  int,
  description    text,
  /** 기능형 소품이 무슨 기능과 연결되는지 — 화면에서 이 값으로 분기합니다 */
  feature_key    text,
  image_url      text,
  sort_order     int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),

  /** 배경이 아닌데 실내/야외가 붙어 있으면 실수입니다 */
  constraint room_items_scene_only_for_background
    check (scene_type is null or category = 'background'),
  /** 자리 이름표는 가구·소품에만 붙습니다 */
  constraint room_items_slot_only_for_furniture_prop
    check (fixed_slot_key is null or category in ('furniture','prop'))
);

create index if not exists idx_room_items_active
  on public.room_items (is_active, category, sort_order);

alter table public.room_items enable row level security;

/** 카탈로그는 로그인한 사람 누구나 읽을 수 있습니다(모두에게 같은 목록) */
drop policy if exists "room_items_read" on public.room_items;
create policy "room_items_read"
  on public.room_items for select
  to authenticated
  using (true);

-- ── 보유 ────────────────────────────────────────────────────
create table if not exists public.child_room_inventory (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.profiles(id) on delete cascade,
  room_item_id uuid not null references public.room_items(id) on delete cascade,
  acquired_at  timestamptz not null default now(),
  unique (child_id, room_item_id)
);

create index if not exists idx_child_room_inventory_child
  on public.child_room_inventory (child_id);

alter table public.child_room_inventory enable row level security;

drop policy if exists "child_room_inventory_access" on public.child_room_inventory;
create policy "child_room_inventory_access"
  on public.child_room_inventory for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links
       where parent_id = auth.uid() and child_id = child_room_inventory.child_id
    )
  )
  with check (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links
       where parent_id = auth.uid() and child_id = child_room_inventory.child_id
    )
  );

-- ── 배경·바닥·러그 (한 종류에 하나만) ───────────────────────
create table if not exists public.child_room_layout (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.profiles(id) on delete cascade,
  category     text not null check (category in ('background','floor','rug')),
  /** null 이면 「아무것도 안 입힘」 */
  room_item_id uuid references public.room_items(id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique (child_id, category)
);

alter table public.child_room_layout enable row level security;

drop policy if exists "child_room_layout_access" on public.child_room_layout;
create policy "child_room_layout_access"
  on public.child_room_layout for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links
       where parent_id = auth.uid() and child_id = child_room_layout.child_id
    )
  )
  with check (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links
       where parent_id = auth.uid() and child_id = child_room_layout.child_id
    )
  );

-- ── 가구·소품 (각각 따로 켜고 끄기) ─────────────────────────
create table if not exists public.child_room_placements (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.profiles(id) on delete cascade,
  room_item_id uuid not null references public.room_items(id) on delete cascade,
  is_placed    boolean not null default false,
  placed_at    timestamptz,
  unique (child_id, room_item_id)
);

create index if not exists idx_child_room_placements_child
  on public.child_room_placements (child_id, is_placed);

alter table public.child_room_placements enable row level security;

drop policy if exists "child_room_placements_access" on public.child_room_placements;
create policy "child_room_placements_access"
  on public.child_room_placements for all
  using (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links
       where parent_id = auth.uid() and child_id = child_room_placements.child_id
    )
  )
  with check (
    auth.uid() = child_id
    or exists (
      select 1 from public.family_links
       where parent_id = auth.uid() and child_id = child_room_placements.child_id
    )
  );

notify pgrst, 'reload schema';
