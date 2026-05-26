-- ============================================================
-- 086_triple_market_credit_prices.sql
-- 마켓 전역: 모든 상품의 크레딧 가격을 3배로 조정합니다.
-- - credit_price = 0 (무료) 행은 0을 유지합니다.
-- - 자녀별 덮어쓰기는 테이블 상한(999999)을 넘지 않게 least 로 캡합니다.
-- 비개발자: 앱은 여전히 DB에 적힌 숫자를 그대로 보여 주고 차감합니다.
-- ============================================================

update public.store_items
set credit_price = credit_price * 3
where credit_price > 0;

update public.child_store_item_credit_overrides
set credit_price = least(999999, credit_price * 3)
where credit_price > 0;
