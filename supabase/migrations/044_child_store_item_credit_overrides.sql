-- ============================================================
-- 044_child_store_item_credit_overrides.sql
-- 1) store_items.credit_price 를 0(무료)부터 허용하도록 CHECK 완화
-- 2) 이벤트 구역 대표 상품 기본 가격 조정(전역 시드)
-- 3) 자녀별 크레딧 덮어쓰기 — 부모가 메뉴 제어에서 자녀마다 다른 가격 설정 가능
--    (전역 store_items 행은 그대로 두고, 이 테이블만 자녀 단위로 조정)
-- ============================================================

-- 1) 기존 양수만 허용하던 제약 제거 후 0 이상으로 재정의
alter table public.store_items drop constraint if exists store_items_credit_price_check;
alter table public.store_items
  add constraint store_items_credit_price_check check (credit_price >= 0);

-- 2) 마켓 「이벤트」 구역: 아빠·엄마 츄·안아주기 쿠폰은 무료, 책 읽기 시간은 5크레딧
--    (이름은 042_hard_reset_store_items 시드와 동일하게 매칭)
update public.store_items
set credit_price = 0
where name in ('아빠 츄 쿠폰', '엄마 츄 쿠폰', '안아주기 쿠폰');

update public.store_items
set credit_price = 5
where name = '책 읽기 시간';

-- 3) 자녀별 덮어쓰기 테이블
create table if not exists public.child_store_item_credit_overrides (
  child_id      uuid not null references public.profiles (id) on delete cascade,
  store_item_id uuid not null references public.store_items (id) on delete cascade,
  credit_price  int not null check (credit_price >= 0 and credit_price <= 999999),
  updated_at    timestamptz not null default now(),
  primary key (child_id, store_item_id)
);

create index if not exists child_store_item_credit_overrides_store_item_id_idx
  on public.child_store_item_credit_overrides (store_item_id);

comment on table public.child_store_item_credit_overrides is
  '자녀 마켓에서 보이는 크레딧 가격 덮어쓰기(없으면 store_items.credit_price 사용).';

alter table public.child_store_item_credit_overrides enable row level security;

grant select, insert, update, delete on public.child_store_item_credit_overrides to authenticated;

-- 자녀 본인: 자신 행 조회
create policy "child_store_item_credit_overrides_child_select"
  on public.child_store_item_credit_overrides
  for select
  using (auth.uid() = child_id);

-- 연결된 부모: 해당 자녀의 덮어쓰기 조회·수정
create policy "child_store_item_credit_overrides_parent_select"
  on public.child_store_item_credit_overrides
  for select
  using (
    exists (
      select 1
      from public.family_links fl
      where fl.child_id = child_store_item_credit_overrides.child_id
        and fl.parent_id = auth.uid()
    )
  );

create policy "child_store_item_credit_overrides_parent_insert"
  on public.child_store_item_credit_overrides
  for insert
  with check (
    exists (
      select 1
      from public.family_links fl
      where fl.child_id = child_store_item_credit_overrides.child_id
        and fl.parent_id = auth.uid()
    )
  );

create policy "child_store_item_credit_overrides_parent_update"
  on public.child_store_item_credit_overrides
  for update
  using (
    exists (
      select 1
      from public.family_links fl
      where fl.child_id = child_store_item_credit_overrides.child_id
        and fl.parent_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.family_links fl
      where fl.child_id = child_store_item_credit_overrides.child_id
        and fl.parent_id = auth.uid()
    )
  );

create policy "child_store_item_credit_overrides_parent_delete"
  on public.child_store_item_credit_overrides
  for delete
  using (
    exists (
      select 1
      from public.family_links fl
      where fl.child_id = child_store_item_credit_overrides.child_id
        and fl.parent_id = auth.uid()
    )
  );
