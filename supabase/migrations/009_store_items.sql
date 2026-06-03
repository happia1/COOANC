-- ============================================================
-- 009_store_items.sql
-- 마켓 상품 테이블 + 초기 상품 데이터
-- family_link_id = NULL → 전체 공개 기본 상품
-- family_link_id = {id} → 특정 가족 전용 상품 (부모 직접 추가)
-- ============================================================

create table if not exists store_items (
  id              uuid primary key default uuid_generate_v4(),
  family_link_id  uuid references family_links(id) on delete cascade,
  name            text not null,
  description     text,
  image_url       text,
  credit_price    int not null check (credit_price > 0),
  item_type       text not null default 'digital'
                    check (item_type in ('digital', 'real')),
  category        text check (category in ('food', 'toy', 'activity', 'digital', 'experience')),
  level_required  int not null default 0,
  is_active       boolean default true,
  stock           int default null,  -- null = 무제한
  created_at      timestamptz default now()
);

-- ============================================================
-- 초기 기본 상품 데이터 (family_link_id = NULL → 전체 공개)
-- ============================================================
insert into store_items (name, description, credit_price, item_type, category, level_required) values
  -- 디지털 min_level=1 시드 (v3: Lv.1 새싹·스티커 구간)
  ('캐릭터 코스튬',     '쿠앵이 특별 코스튬 아이템',    15, 'digital', 'digital',    1),
  ('스티커 팩',         '예쁜 디지털 스티커 10장',       10, 'digital', 'digital',    1),
  ('배경화면 테마',     '내 방 배경을 꾸며요!',           20, 'digital', 'digital',    1),
  ('유튜브 30분 이용권','부모 승인 후 유튜브 30분!',      20, 'digital', 'experience', 1),
  ('디저트 선택권',     '오늘 디저트 내가 고른다!',       15, 'digital', 'experience', 1),

  -- 실물 아이템 min_level=2 시드 (v3: 마켓 Lv.0~, 「교환사」레벨 해금 없음)
  ('과자 한 봉지',      '편의점 과자 내가 고른다!',       50, 'real',    'food',       2),
  ('아이스크림',        '시원한 아이스크림 한 개!',        30, 'real',    'food',       2),
  ('초콜릿',            '달콤한 초콜릿 선물',              20, 'real',    'food',       2),
  ('색연필 세트',       '새 색연필 12색 세트',             80, 'real',    'toy',        2),
  ('스티커 세트',       '반짝이 스티커 모음',              25, 'real',    'toy',        2),

  -- 경험/활동 min_level=2 시드 (v3: 앱 해금은 EXP·기능 아이콘 기준)
  ('공원 나들이',       '가족이랑 공원에서 놀기!',        150, 'real',    'activity',   2),
  ('영화 보기',         '가족이랑 영화 한 편!',           200, 'real',    'activity',   2),
  ('게임 30분',         '부모 승인 게임 30분',             40, 'digital', 'experience', 2),

  -- 고급 min_level=3 시드 (v3: 저축왕=Lv.5, 컬럼은 시드 호환용)
  ('장난감 뽑기',       '문구점 장난감 뽑기 1회!',        100, 'real',   'toy',        3),
  ('외식 메뉴 선택권',  '오늘 저녁 메뉴 내가 결정!',      120, 'real',   'experience', 3),
  ('책 구매권',         '원하는 책 한 권 구매!',           150, 'real',   'experience', 3);
