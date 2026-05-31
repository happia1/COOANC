-- ============================================================
-- 098_snack_rename_images_and_remove_drink.sql
--
-- 비개발자 요약:
--   • 바삭 칩스 → 과자, 푸딩 → 과일 푸딩 이름 변경
--   • 치즈·어린이 영양제·아이스크림 일러스트 경로 갱신
--   • 음료수 상품 삭제
-- ============================================================

-- 1) 상품명 변경
update public.store_items
set
  name = '과자',
  description = '바삭한 과자 간식이에요.'
where family_link_id is null
  and category = 'food'
  and name = '바삭 칩스';

update public.store_items
set
  name = '과일 푸딩',
  description = '달콤한 과일 푸딩이에요.'
where family_link_id is null
  and category = 'food'
  and name = '푸딩';

-- 2) 일러스트 경로 갱신
update public.store_items
set image_url = '/assets/img/items/shop/items/건강간식/stringcheese.png'
where family_link_id is null
  and category = 'food'
  and name = '치즈';

update public.store_items
set image_url = '/assets/img/items/shop/items/건강간식/vitamine.png'
where family_link_id is null
  and category = 'food'
  and name = '어린이 영양제';

update public.store_items
set image_url = '/assets/img/items/shop/items/건강간식/icepop.png'
where family_link_id is null
  and category = 'food'
  and name = '아이스크림';

-- 3) 구매 이력 스냅샷 상품명 맞춤
update public.purchase_requests
set item_name = '과자'
where item_name = '바삭 칩스';

update public.purchase_requests
set item_name = '과일 푸딩'
where item_name = '푸딩';

-- 4) 음료수 삭제
update public.purchase_requests
set item_id = null
where item_id in (
  select id
  from public.store_items
  where category = 'food'
    and name = '음료수'
);

delete from public.store_items
where category = 'food'
  and name = '음료수';
