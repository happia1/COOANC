-- ============================================================
-- 104_content_market_image_paths.sql
-- 콘텐츠 마켓 상품 일러스트를 `shop/items/콘텐츠/` 폴더 경로로 갱신
-- ============================================================

update public.store_items
set image_url = '/assets/img/items/shop/items/콘텐츠/contents.png'
where family_link_id is null
  and category = 'content'
  and name = '영상 시청권 30분';

update public.store_items
set image_url = '/assets/img/items/shop/items/콘텐츠/minigame.png'
where family_link_id is null
  and category = 'content'
  and name = '미니게임 이용권';
