-- ============================================================
-- 101_sync_snack_catalog_names_and_images.sql
--
-- 097~100 마이그레이션이 아직 DB에 반영되지 않았을 때 한 번에 맞춥니다.
-- 이름·설명·일러스트 경로를 현재 카탈로그 기준으로 통일합니다(재실행 안전).
-- ============================================================

-- 1) 예전 이름 → 현재 이름
update public.store_items
set name = case
  when name = '젤리' then '비타민 구미'
  when name = '육포' then '어린이 육포'
  when name in ('츄잉껌', '츄잉검') then '츄잉캔디'
  when name = '텐텐' then '어린이 영양제'
  when name = '바삭 칩스' then '칩스'
  when name = '과자' then '칩스'
  when name = '푸딩' then '과일 푸딩'
  when name = '치즈' then '스트링치즈'
  else name
end
where family_link_id is null
  and category = 'food'
  and name in (
    '젤리',
    '육포',
    '츄잉껌',
    '츄잉검',
    '텐텐',
    '바삭 칩스',
    '과자',
    '푸딩',
    '치즈'
  );

-- 2) 설명 통일
update public.store_items
set description = case name
  when '비타민 구미' then '비타민 구미 간식이에요.'
  when '어린이 육포' then '맛있는 어린이 육포 간식이에요.'
  when '츄잉캔디' then '달콤한 츄잉캔디 간식이에요.'
  when '어린이 영양제' then '어린이 영양제 간식이에요.'
  when '스트링치즈' then '고소한 스트링치즈 간식이에요.'
  when '칩스' then '바삭한 칩스 간식이에요.'
  when '과일 푸딩' then '달콤한 과일 푸딩이에요.'
  when '크래커' then '바삭한 크래커 간식이에요.'
  else description
end
where family_link_id is null
  and category = 'food'
  and name in (
    '비타민 구미',
    '어린이 육포',
    '츄잉캔디',
    '어린이 영양제',
    '스트링치즈',
    '칩스',
    '과일 푸딩',
    '크래커'
  );

-- 3) 일러스트 경로 통일
update public.store_items
set image_url = case name
  when '어린이 영양제' then '/assets/img/items/shop/items/건강간식/vitamine.png'
  when '스트링치즈' then '/assets/img/items/shop/items/건강간식/stringcheese.png'
  when '아이스크림' then '/assets/img/items/shop/items/건강간식/icepop.png'
  when '칩스' then '/assets/img/items/shop/items/건강간식/chips.png'
  when '과일 푸딩' then '/assets/img/items/shop/items/건강간식/pudding.png'
  when '크래커' then '/assets/img/items/shop/items/건강간식/cracker.png'
  else image_url
end
where family_link_id is null
  and category = 'food'
  and name in (
    '어린이 영양제',
    '스트링치즈',
    '아이스크림',
    '칩스',
    '과일 푸딩',
    '크래커'
  );

-- 4) 크래커 없으면 추가
insert into public.store_items (
  name,
  description,
  image_url,
  credit_price,
  item_type,
  category,
  level_required,
  is_active
)
select
  '크래커',
  '바삭한 크래커 간식이에요.',
  '/assets/img/items/shop/items/건강간식/cracker.png',
  coalesce(
    (
      select si.credit_price
      from public.store_items si
      where si.family_link_id is null
        and si.category = 'food'
        and si.name = '칩스'
      limit 1
    ),
    100
  ),
  'real',
  'food',
  1,
  true
where not exists (
  select 1
  from public.store_items si
  where si.family_link_id is null
    and si.category = 'food'
    and si.name = '크래커'
);

-- 5) 기본 간식 전부 활성화
update public.store_items
set is_active = true
where category = 'food'
  and family_link_id is null
  and is_active = false;

-- 6) 구매 이력 스냅샷 이름
update public.purchase_requests
set item_name = case item_name
  when '젤리' then '비타민 구미'
  when '육포' then '어린이 육포'
  when '츄잉껌' then '츄잉캔디'
  when '츄잉검' then '츄잉캔디'
  when '텐텐' then '어린이 영양제'
  when '치즈' then '스트링치즈'
  when '바삭 칩스' then '칩스'
  when '과자' then '칩스'
  when '푸딩' then '과일 푸딩'
  else item_name
end
where item_name in (
  '젤리',
  '육포',
  '츄잉껌',
  '츄잉검',
  '텐텐',
  '치즈',
  '바삭 칩스',
  '과자',
  '푸딩'
);

-- 7) 음료수·뽀로로 제거
update public.purchase_requests
set item_id = null
where item_id in (
  select id
  from public.store_items
  where category = 'food'
    and name in ('음료수', '뽀로로')
);

delete from public.store_items
where category = 'food'
  and name in ('음료수', '뽀로로');
