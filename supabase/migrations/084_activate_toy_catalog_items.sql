-- ============================================================
-- 084_activate_toy_catalog_items.sql
--
-- 비개발자 요약:
--   • 부모/자녀 마켓 화면은 is_active=true 인 상품만 불러옵니다.
--   • 기존 시드(073)에서 장난감(toy)이 전부 false 라 메뉴 제어/마켓에 안 보였습니다.
--   • 기본 카탈로그(family_link_id is null)의 장난감만 true로 켭니다.
-- ============================================================

update public.store_items
set is_active = true
where category = 'toy'
  and family_link_id is null
  and is_active = false;
