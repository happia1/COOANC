-- ============================================================
-- 042_hard_reset_store_items.sql
-- 요청 반영: 마켓 아이템/요청 히스토리를 전부 삭제하고 새 목록으로 재구성
--
-- 이 마이그레이션은 아래 데이터를 "완전 삭제"합니다.
-- 1) purchase_requests (구매 요청 히스토리)
-- 2) market_wishlist_items (장바구니)
-- 3) child_market_hidden_items (부모 숨김 설정)
-- 4) store_items (기본/가족 전용 포함 전체 상품)
-- ============================================================

-- FK 제약 순서를 고려해 자식 테이블부터 정리합니다.
delete from public.purchase_requests;
delete from public.market_wishlist_items;
delete from public.child_market_hidden_items;
delete from public.store_items;

-- 새 기본 상품 등록 (모두 기본 노출: is_active=true)
-- 요청 반영: 각 상품은 추가된 PNG 파일과 1:1로 맞춰 image_url 을 직접 넣습니다.
insert into public.store_items (name, description, image_url, credit_price, item_type, category, level_required, is_active)
values
  -- 간식/음료 (food)
  ('바삭 칩스', '바삭한 칩스 간식이에요.', '/assets/img/items/shop/items/chips.png', 50, 'real', 'food', 1, true),
  ('츄잉껌', '쫄깃한 츄잉껌이에요.', '/assets/img/items/shop/items/chew.png', 30, 'real', 'food', 1, true),
  ('츄잉껌 플러스', '다른 맛의 츄잉껌이에요.', '/assets/img/items/shop/items/chew2.png', 30, 'real', 'food', 1, true),
  ('초코우유', '달콤한 초코우유예요.', '/assets/img/items/shop/items/choco_milk.png', 35, 'real', 'food', 1, true),
  ('초콜릿', '달콤한 초콜릿이에요.', '/assets/img/items/shop/items/chocolate.png', 40, 'real', 'food', 1, true),
  ('킨더 초콜릿', '놀라운 선물이 있는 초콜릿이에요.', '/assets/img/items/shop/items/kinderjoy_chocolate.png', 60, 'real', 'food', 1, true),
  ('캔디', '알록달록 캔디예요.', '/assets/img/items/shop/items/candy.png', 30, 'real', 'food', 1, true),
  ('쿠키', '고소한 쿠키예요.', '/assets/img/items/shop/items/coockie.png', 35, 'real', 'food', 1, true),
  ('젤리', '탱글탱글 젤리예요.', '/assets/img/items/shop/items/gummy.png', 30, 'real', 'food', 1, true),
  ('초코볼', '동글동글 초코볼이에요.', '/assets/img/items/shop/items/chocoball.png', 35, 'real', 'food', 1, true),
  ('디저트', '달콤한 디저트예요.', '/assets/img/items/shop/items/dessert.png', 45, 'real', 'food', 1, true),
  ('푸딩', '부드러운 푸딩이에요.', '/assets/img/items/shop/items/pudding.png', 40, 'real', 'food', 1, true),
  ('아이스크림', '시원한 아이스크림이에요.', '/assets/img/items/shop/items/icecream.png', 45, 'real', 'food', 1, true),
  ('탄산음료', '시원한 음료수예요.', '/assets/img/items/shop/items/drink.png', 35, 'real', 'food', 1, true),
  ('블루베리 주스', '상큼한 블루베리 주스예요.', '/assets/img/items/shop/items/bluberry_juice.png', 40, 'real', 'food', 1, true),
  ('딸기 주스', '상큼한 딸기 주스예요.', '/assets/img/items/shop/items/strawberry_juice.png', 40, 'real', 'food', 1, true),
  ('망고 주스', '달콤한 망고 주스예요.', '/assets/img/items/shop/items/mango_juice.png', 40, 'real', 'food', 1, true),
  ('딸기우유', '달콤한 딸기우유예요.', '/assets/img/items/shop/items/strawberry_milk.png', 35, 'real', 'food', 1, true),

  -- 장난감 (toy)
  ('곰 인형', '포근한 곰 인형이에요.', '/assets/img/items/shop/items/bear.png', 90, 'real', 'toy', 1, true),
  ('블록 장난감', '쌓아서 만드는 블록 장난감이에요.', '/assets/img/items/shop/items/blocks.png', 110, 'real', 'toy', 1, true),
  ('장난감 세트', '여러 장난감이 들어 있는 세트예요.', '/assets/img/items/shop/items/toys.png', 120, 'real', 'toy', 1, true),
  ('기차 장난감', '재미있는 기차 장난감이에요.', '/assets/img/items/shop/items/train_toy.png', 120, 'real', 'toy', 1, true),
  ('보드게임', '함께 즐기는 보드게임이에요.', '/assets/img/items/shop/items/board_game.png', 130, 'real', 'toy', 1, true),
  ('전동 드릴 놀이', '안전한 드릴 역할놀이 세트예요.', '/assets/img/items/shop/items/drill_play_set.png', 130, 'real', 'toy', 1, true),
  ('아트 키트', '창의력을 키우는 아트 키트예요.', '/assets/img/items/shop/items/art_kit.png', 115, 'real', 'toy', 1, true),
  ('색연필 세트', '다양한 색으로 그릴 수 있어요.', '/assets/img/items/shop/items/color_pen_set.png', 95, 'real', 'toy', 1, true),
  ('펜 세트', '필기와 그림에 좋은 펜 세트예요.', '/assets/img/items/shop/items/pen.png', 75, 'real', 'toy', 1, true),
  ('럭키박스', '무엇이 나올지 모르는 럭키박스예요.', '/assets/img/items/shop/items/luckybox.png', 130, 'real', 'toy', 1, true),
  ('비눗방울 놀이', '신나는 비눗방울 놀이예요.', '/assets/img/items/shop/items/bubble.png', 70, 'real', 'toy', 1, true),
  ('모래놀이 도구', '재미있는 모래놀이 도구예요.', '/assets/img/items/shop/items/sand_play_tool.png', 95, 'real', 'toy', 1, true),
  ('텐트 캠핑놀이', '집에서 하는 캠핑놀이예요.', '/assets/img/items/shop/items/tent_camping.png', 140, 'real', 'toy', 1, true),
  ('시장놀이 세트', '역할놀이용 시장놀이 세트예요.', '/assets/img/items/shop/items/market_play.png', 120, 'real', 'toy', 1, true),
  ('은행놀이 세트', '돈 개념을 배우는 은행놀이예요.', '/assets/img/items/shop/items/bank_play.png', 120, 'real', 'toy', 1, true),

  -- 이벤트·활동 (activity)
  ('베이킹 체험', '함께 만드는 베이킹 활동이에요.', '/assets/img/items/shop/items/baking.png', 150, 'real', 'activity', 1, true),
  ('그림 그리기', '자유롭게 그림을 그리는 활동이에요.', '/assets/img/items/shop/items/drawing.png', 90, 'real', 'activity', 1, true),
  ('책 읽기 시간', '집중해서 책 읽는 시간이예요.', '/assets/img/items/shop/items/read_book.png', 80, 'real', 'activity', 1, true),
  ('책 선물', '새 책을 선물받아요.', '/assets/img/items/shop/items/book.png', 120, 'real', 'activity', 1, true),
  ('영화 보기', '가족과 함께 영화 보는 시간이에요.', '/assets/img/items/shop/items/movie.png', 160, 'real', 'activity', 1, true),
  ('안아주기 쿠폰', '따뜻하게 안아주는 쿠폰이에요.', '/assets/img/items/shop/items/hug.png', 60, 'real', 'activity', 1, true),
  ('꽃 선물', '예쁜 꽃을 선물해요.', '/assets/img/items/shop/items/flower.png', 80, 'real', 'activity', 1, true),

  -- 특별 체험 (experience)
  ('엄마 츄 쿠폰', '엄마와 특별한 시간을 보내요.', '/assets/img/items/shop/items/mom_chu.png', 90, 'digital', 'experience', 1, true),
  ('아빠 츄 쿠폰', '아빠와 특별한 시간을 보내요.', '/assets/img/items/shop/items/papa_chu.png', 90, 'digital', 'experience', 1, true),
  ('미용실 체험', '머리 손질 체험이에요.', '/assets/img/items/shop/items/hairshop.png', 180, 'real', 'experience', 1, true),
  ('드레스업 체험', '예쁘게 꾸며보는 체험이에요.', '/assets/img/items/shop/items/dress.png', 170, 'real', 'experience', 1, true);

