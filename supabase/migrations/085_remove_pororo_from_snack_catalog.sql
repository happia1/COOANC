-- ============================================================
-- 085_remove_pororo_from_snack_catalog.sql
--
-- 비개발자 요약:
--   • 간식 목록에서 「뽀로로」를 제거하기 위해 해당 상품을 비활성화합니다.
--   • 과거 구매/요청 데이터 연결을 깨지 않도록 행 삭제 대신 is_active=false 를 사용합니다.
-- ============================================================

update public.store_items
set is_active = false
where category = 'food'
  and name = '뽀로로';
