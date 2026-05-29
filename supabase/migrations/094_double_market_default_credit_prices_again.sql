-- ============================================================
-- 094_double_market_default_credit_prices_again.sql
-- 메뉴제어의 "기본값" 상품 크레딧을 현재 값 기준으로 2배 인상합니다.
-- - 대상: 기본 카탈로그 상품(store_items.family_link_id is null)
-- - 제외: 무료 상품(credit_price = 0), 자녀별 개별 덮어쓰기(child_store_item_credit_overrides)
-- 비개발자: 예) 견과류 40 -> 80
-- ============================================================

update public.store_items
set credit_price = credit_price * 2
where family_link_id is null
  and credit_price > 0;
