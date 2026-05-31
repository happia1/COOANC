-- ============================================================
-- 099_snack_full_catalog_order.sql
--
-- 비개발자 요약:
--   • 기본 간식 카탈로그 전부 활성화
--   • 치즈→스트링치즈, 과자→칩스 이름 변경
--   • MVP 간식 노출 순서는 앱 `betaMarketConfig.activeFood` 와 동일
-- ============================================================

-- 1) 상품명 변경
update public.store_items
set
  name = '스트링치즈',
  description = '고소한 스트링치즈 간식이에요.'
where family_link_id is null
  and category = 'food'
  and name = '치즈';

update public.store_items
set
  name = '칩스',
  description = '바삭한 칩스 간식이에요.'
where family_link_id is null
  and category = 'food'
  and name = '과자';

-- 2) 기본 카탈로그 간식 전부 활성화
update public.store_items
set is_active = true
where category = 'food'
  and family_link_id is null
  and is_active = false;

-- 3) 구매 이력 스냅샷 상품명 맞춤
update public.purchase_requests
set item_name = '스트링치즈'
where item_name = '치즈';

update public.purchase_requests
set item_name = '칩스'
where item_name in ('과자', '바삭 칩스');
