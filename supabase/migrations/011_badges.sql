-- ============================================================
-- 011_badges.sql
-- 뱃지 정의 테이블 + 자녀 획득 뱃지 테이블 + 초기 뱃지 데이터
-- ============================================================

create table if not exists badges (
  id          uuid primary key default uuid_generate_v4(),
  badge_id    text unique not null,     -- 코드 키 (예: 'first_credit')
  name        text not null,
  description text,
  icon_emoji  text,
  badge_type  text check (badge_type in ('level', 'streak', 'eq', 'special')),
  condition   jsonb                     -- 획득 조건 메타데이터
);

create table if not exists child_badges (
  id          uuid primary key default uuid_generate_v4(),
  child_id    uuid not null references profiles(id) on delete cascade,
  badge_id    text not null references badges(badge_id),
  earned_at   timestamptz default now(),
  unique (child_id, badge_id)
);

-- ============================================================
-- 초기 뱃지 데이터
-- ============================================================
insert into badges (badge_id, name, description, icon_emoji, badge_type, condition) values
  -- 레벨 달성 뱃지
  ('first_credit',  '첫 크레딧',   '처음으로 미션을 완료해 크레딧을 받았어요!', '🪙', 'level',  '{"event":"first_mission_complete"}'),
  ('first_purchase','첫 구매',     '처음으로 마켓에서 구매 요청을 했어요!',     '🛒', 'level',  '{"event":"first_purchase"}'),
  ('first_real',    '첫 실물교환', '처음으로 진짜 물건으로 교환했어요!',        '📦', 'level',  '{"event":"first_real_purchase"}'),
  ('goal_achieved', '목표 달성자', '저금통 목표를 달성했어요!',                  '🎯', 'level',  '{"event":"savings_goal_achieved"}'),
  ('sharing_hero',  '나눔 영웅',   '선물하기와 기부를 모두 해봤어요!',          '💝', 'level',  '{"gift_count":1,"donation_count":1}'),
  -- v3 Lv.5 단계명은 「저축왕」; 아래 title 「투자가」는 레거시 시드(행 데이터 호환 유지)
  ('investor',      '투자가',      '투자 농장에서 첫 수확을 했어요!',           '🚀', 'level',  '{"event":"farm_harvest"}'),

  -- 스트릭 뱃지
  ('streak_7',      '7일 스트릭',  '7일 연속으로 미션을 완료했어요!',           '🔥', 'streak', '{"streak_days":7}'),
  ('streak_30',     '30일 스트릭', '30일 연속으로 미션을 완료했어요!',          '🔥', 'streak', '{"streak_days":30}'),
  ('streak_100',    '100일 스트릭','100일 연속 달성! 진짜 챔피언!',             '👑', 'streak', '{"streak_days":100}'),

  -- EQ 뱃지
  ('eq_master',     'EQ 마스터',   'EQ 3축 점수가 모두 70점 이상이에요!',       '🌟', 'eq',     '{"all_eq_above":70}'),

  -- 특별 뱃지
  ('earth_keeper',  '지구 지킴이', '기부 크레딧 누적 100 이상!',                '🌳', 'special','{"total_donation":100}'),
  ('gift_fairy',    '선물 요정',   '선물하기 5회 이상!',                        '🎁', 'special','{"gift_count":5}'),
  ('top_ranker',    '또래 1위',    '주간 랭킹 1위 달성!',                       '👑', 'special','{"event":"weekly_rank_1"}');
