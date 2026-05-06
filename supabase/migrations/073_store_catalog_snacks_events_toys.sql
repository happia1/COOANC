-- ============================================================
-- 073_store_catalog_snacks_events_toys.sql
--
-- 마켓 상품을 「건강간식」「이벤트」「장난감」폴더 구조에 맞춰 전면 재시드합니다.
-- 비개발자 요약:
--   • 기존 구매요청·장바구니·숨김 설정은 비워진 뒤(`042`와 동일 패턴) 새 행만 넣습니다.
--   • MVP 간식: 견과류→…→딸기우유 순서대로 is_active=true, 나머지 간식은 false.
--   • 이벤트: 엄마 뽀뽀·아빠 뽀뽀·책 읽어주세요·안아주세요 만 활성(true).
--   • 장난감: 전부 비활성(false).
--
-- 이미지: `public/assets/img/items/shop/items/<건강간식|이벤트|장난감>/...png`
-- 뽀로로 이미지: `건강간식/뽀로로.png` (레포에는 텐텐 일러스트 복사본을 자리 표시로 두었으며, 추후 교체하면 됩니다.)
-- ============================================================

delete from public.purchase_requests;
delete from public.market_wishlist_items;
delete from public.child_market_hidden_items;
delete from public.child_store_item_credit_overrides;
delete from public.store_items;

insert into public.store_items (name, description, image_url, credit_price, item_type, category, level_required, is_active)
values
  -- ── 건강간식 (food) — 표시 순서는 앱에서 betaMarketConfig.activeFood 순서를 따릅니다.
  ('견과류', '고소한 견과류 간식이에요.', '/assets/img/items/shop/items/건강간식/견과류.png', 40, 'real', 'food', 1, true),
  ('초콜릿', '달콤한 초콜릿이에요.', '/assets/img/items/shop/items/건강간식/chocolate.png', 40, 'real', 'food', 1, true),
  ('텐텐', '달콤한 텐텐 간식이에요.', '/assets/img/items/shop/items/건강간식/텐텐.png', 35, 'real', 'food', 1, true),
  ('치즈', '고소한 치즈 간식이에요.', '/assets/img/items/shop/items/건강간식/치즈.png', 38, 'real', 'food', 1, true),
  ('육포', '짭짤한 육포 간식이에요.', '/assets/img/items/shop/items/건강간식/육포.png', 45, 'real', 'food', 1, true),
  ('그릭요거트', '부드러운 그릭 요거트예요.', '/assets/img/items/shop/items/건강간식/그릭요거트.png', 38, 'real', 'food', 1, true),
  ('뮤즐리', '바삭한 뮤즐리 간식이에요.', '/assets/img/items/shop/items/건강간식/뮤즐리.png', 36, 'real', 'food', 1, true),
  ('젤리', '탱글탱글 젤리예요.', '/assets/img/items/shop/items/건강간식/젤리.png', 30, 'real', 'food', 1, true),
  ('팝콘', '바삭한 팝콘이에요.', '/assets/img/items/shop/items/건강간식/팝콘.png', 32, 'real', 'food', 1, true),
  ('뽀로로', '아이들이 좋아하는 뽀로로 간식이에요.', '/assets/img/items/shop/items/건강간식/뽀로로.png', 40, 'real', 'food', 1, true),
  ('츄잉껌', '쫄깃한 츄잉껌이에요.', '/assets/img/items/shop/items/건강간식/chew.png', 30, 'real', 'food', 1, true),
  ('초코우유', '달콤한 초코우유예요.', '/assets/img/items/shop/items/건강간식/choco_milk.png', 35, 'real', 'food', 1, true),
  ('딸기우유', '달콤한 딸기우유예요.', '/assets/img/items/shop/items/건강간식/strawberry_milk.png', 35, 'real', 'food', 1, true),

  ('바삭 칩스', '바삭한 칩스 간식이에요.', '/assets/img/items/shop/items/건강간식/chips.png', 50, 'real', 'food', 1, false),
  ('초코볼', '동글동글 초코볼이에요.', '/assets/img/items/shop/items/건강간식/chocoball.png', 35, 'real', 'food', 1, false),
  ('블루베리 주스', '상큼한 블루베리 주스예요.', '/assets/img/items/shop/items/건강간식/bluberry_juice.png', 40, 'real', 'food', 1, false),
  ('음료수', '시원한 음료 한 잔이에요.', '/assets/img/items/shop/items/건강간식/drink.png', 35, 'real', 'food', 1, false),
  ('망고 주스', '달콤한 망고 주스예요.', '/assets/img/items/shop/items/건강간식/mango_juice.png', 40, 'real', 'food', 1, false),
  ('딸기 주스', '상큼한 딸기 주스예요.', '/assets/img/items/shop/items/건강간식/strawberry_juice.png', 40, 'real', 'food', 1, false),
  ('푸딩', '부드러운 푸딩이에요.', '/assets/img/items/shop/items/건강간식/pudding.png', 40, 'real', 'food', 1, false),
  ('아이스크림', '시원한 아이스크림이에요.', '/assets/img/items/shop/items/건강간식/icecream.png', 45, 'real', 'food', 1, false),

  -- ── 이벤트 (부모 앱 「이벤트」탭: activity + experience)
  ('엄마 뽀뽀', '엄마와 뽀뽀로 마음을 표현해요.', '/assets/img/items/shop/items/이벤트/mom_chu.png', 0, 'digital', 'experience', 1, true),
  ('아빠 뽀뽀', '아빠와 뽀뽀로 마음을 표현해요.', '/assets/img/items/shop/items/이벤트/papa_chu.png', 0, 'digital', 'experience', 1, true),
  ('책 읽어주세요', '함께 책을 읽어 주세요.', '/assets/img/items/shop/items/이벤트/read_book.png', 5, 'real', 'activity', 1, true),
  ('안아주세요', '따뜻하게 안아 주세요.', '/assets/img/items/shop/items/이벤트/hug.png', 0, 'real', 'activity', 1, true),

  -- ── 장난감 (toy) — MVP 에서 전부 비활성
  ('곰 인형', '포근한 곰 인형이에요.', '/assets/img/items/shop/items/장난감/bear.png', 90, 'real', 'toy', 1, false),
  ('보드게임', '함께 즐기는 보드게임이에요.', '/assets/img/items/shop/items/장난감/board_game.png', 130, 'real', 'toy', 1, false),
  ('베이킹 놀이', '미니 베이킹 역할놀이예요.', '/assets/img/items/shop/items/장난감/baking.png', 120, 'real', 'toy', 1, false),
  ('그림 그리기 세트', '색으로 그림을 그려요.', '/assets/img/items/shop/items/장난감/drawing.png', 90, 'real', 'toy', 1, false),
  ('텐트 캠핑놀이', '집에서 하는 캠핑놀이예요.', '/assets/img/items/shop/items/장난감/tent_camping.png', 140, 'real', 'toy', 1, false),
  ('색연필 세트', '다양한 색으로 그릴 수 있어요.', '/assets/img/items/shop/items/장난감/color_pen_set.png', 95, 'real', 'toy', 1, false),
  ('모래놀이 도구', '모래놀이 도구 세트예요.', '/assets/img/items/shop/items/장난감/sand_play_tool.png', 95, 'real', 'toy', 1, false),
  ('시장놀이 세트', '역할놀이 시장 세트예요.', '/assets/img/items/shop/items/장난감/market_play.png', 120, 'real', 'toy', 1, false),
  ('기차 장난감', '재미있는 기차 장난감이에요.', '/assets/img/items/shop/items/장난감/train_toy.png', 120, 'real', 'toy', 1, false),
  ('비눗방울 놀이', '신나는 비눗방울 놀이예요.', '/assets/img/items/shop/items/장난감/bubble.png', 70, 'real', 'toy', 1, false),
  ('아트 키트', '창의력을 키우는 아트 키트예요.', '/assets/img/items/shop/items/장난감/art_kit.png', 115, 'real', 'toy', 1, false),
  ('그림책 놀이', '책을 소품으로 하는 놀이예요.', '/assets/img/items/shop/items/장난감/book.png', 110, 'real', 'toy', 1, false),
  ('은행놀이 세트', '돈 개념 은행놀이예요.', '/assets/img/items/shop/items/장난감/bank_play.png', 120, 'real', 'toy', 1, false),
  ('전동 드릴 놀이', '안전한 드릴 역할놀이 세트예요.', '/assets/img/items/shop/items/장난감/drill_play_set.png', 130, 'real', 'toy', 1, false),
  ('드레스업 놀이', '옷을 골라 입는 놀이예요.', '/assets/img/items/shop/items/장난감/dress.png', 110, 'real', 'toy', 1, false),
  ('미용실 놀이', '머리 손질 역할놀이예요.', '/assets/img/items/shop/items/장난감/hairshop.png', 130, 'real', 'toy', 1, false),
  ('장난감 세트', '여러 장난감이 들어 있는 세트예요.', '/assets/img/items/shop/items/장난감/toys.png', 120, 'real', 'toy', 1, false);
