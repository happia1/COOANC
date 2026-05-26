-- ============================================================
-- 089_double_market_default_credit_prices.sql
-- 마켓 기본 상품 가격(`store_items.credit_price`)을 2배로 조정합니다.
-- - `credit_price = 0`(무료 상품)은 그대로 유지합니다.
-- - 자녀별 개별 덮어쓰기(`child_store_item_credit_overrides`)는 변경하지 않습니다.
-- ============================================================

update public.store_items
set credit_price = credit_price * 2
where credit_price > 0;
