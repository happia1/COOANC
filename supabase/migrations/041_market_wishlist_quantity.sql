-- ============================================================
-- 041: 마켓 장바구니 수량 지원
-- - 기존 unique(child_id, store_item_id)는 유지
-- - 각 행에 quantity(최소 1)를 추가해 + / - 조작 가능하게 확장
-- ============================================================

alter table public.market_wishlist_items
  add column if not exists quantity int not null default 1;

alter table public.market_wishlist_items
  drop constraint if exists market_wishlist_items_quantity_check;

alter table public.market_wishlist_items
  add constraint market_wishlist_items_quantity_check
  check (quantity >= 1);
