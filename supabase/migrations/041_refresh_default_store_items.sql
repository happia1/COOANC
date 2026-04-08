-- ============================================================
-- 041_refresh_default_store_items.sql
-- 기본(전체 공개) 마켓 상품을 새 목록으로 교체합니다.
--
-- 주의:
-- - 기존 기본 상품을 "삭제"하면 purchase_requests 등 FK 때문에 실패할 수 있어,
--   안전하게 is_active=false 로 비활성화(화면에서 숨김) 처리합니다.
-- - 가족 전용 상품(family_link_id IS NOT NULL)은 건드리지 않습니다.
-- ============================================================

-- 1) 기존 기본 상품 비활성화(목록에서 제거)
update public.store_items
set is_active = false
where family_link_id is null;

-- 2) 새 기본 상품 추가
-- 이미지: `public/assets/img/items/shop/items/*.png` 를 코드에서 기본으로 매핑해 사용합니다.
insert into public.store_items (name, description, image_url, credit_price, item_type, category, level_required, is_active)
values
  -- 간식/음료 (food)
  ('칩스',             '바삭바삭 칩스 간식이에요.',                              null, 50, 'real', 'food', 1, true),
  ('츄잉껌',           '쫄깃쫄깃 츄잉껌 간식이에요.',                            null, 30, 'real', 'food', 1, true),
  ('츄잉껌(2)',         '다른 모양의 츄잉껌 간식이에요.',                         null, 30, 'real', 'food', 1, true),
  ('초코우유',         '달콤한 초코우유 한 잔이에요.',                           null, 35, 'real', 'food', 1, true),
  ('초콜릿',           '달콤한 초콜릿이에요.',                                  null, 40, 'real', 'food', 1, true),
  ('초콜릿(2)',         '다른 모양의 초콜릿이에요.',                             null, 40, 'real', 'food', 1, true),
  ('쿠키',             '고소한 쿠키 간식이에요.',                                null, 35, 'real', 'food', 1, true),
  ('젤리',             '알록달록 젤리 간식이에요.',                              null, 30, 'real', 'food', 1, true),
  ('아이스크림',       '시원한 아이스크림이에요.',                               null, 45, 'real', 'food', 1, true),
  ('음료수',           '톡 쏘는 음료수 한 잔이에요.',                             null, 35, 'real', 'food', 1, true),
  ('블루베리 주스',     '상큼한 블루베리 주스예요.',                             null, 40, 'real', 'food', 1, true),
  ('딸기우유',         '달콤한 딸기우유 한 잔이에요.',                           null, 35, 'real', 'food', 1, true),
  ('망고 주스',         '상큼한 망고 주스예요.',                                 null, 40, 'real', 'food', 1, true),
  ('딸기 주스',         '상큼한 딸기 주스예요.',                                 null, 40, 'real', 'food', 1, true),
  ('푸딩',             '부드러운 푸딩 간식이에요.',                              null, 40, 'real', 'food', 1, true),
  ('킨더조이 초콜릿',   '장난감이 들어 있는 초콜릿 간식이에요.',                  null, 60, 'real', 'food', 1, true),

  -- 장난감 (toy)
  ('곰 인형',           '포근한 곰 인형이에요.',                                  null, 90,  'real', 'toy', 1, true),
  ('블록 장난감',       '쌓아서 만드는 블록 장난감이에요.',                       null, 110, 'real', 'toy', 1, true),
  ('장난감 세트',       '여러 장난감이 들어 있는 세트예요.',                       null, 120, 'real', 'toy', 1, true),
  ('럭키박스',         '무엇이 나올지 모르는 럭키박스예요.',                       null, 130, 'real', 'toy', 1, true),
  ('꽃 선물',           '예쁜 꽃 선물이에요.',                                    null, 80,  'real', 'toy', 1, true);

