-- ============================================================
-- 005_missions.sql
-- 미션 정의 테이블 + 레벨별 초기 미션 데이터
-- (전역 미션 풀 — 부모가 자녀에게 assign 시 mission_logs 생성)
-- ============================================================

create table if not exists missions (
  id              uuid primary key default uuid_generate_v4(),
  level_required  int not null default 0 check (level_required between 0 and 5),
  title           text not null,
  description     text,
  icon_emoji      text default '✅',
  credit_reward   int not null default 1 check (credit_reward >= 0),
  heart_reward    int not null default 1 check (heart_reward >= 0),
  exp_reward      int not null default 10,
  concept_tag     text check (concept_tag in (
                    '미션','교환','저축','나눔','투자','도전','학습','기여','건강','습관'
                  )),
  difficulty      text not null default 'normal'
                    check (difficulty in ('easy','normal','hard','special')),
  repeat_type     text not null default 'daily'
                    check (repeat_type in ('daily','weekly','monthly','event')),
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- ============================================================
-- 레벨별 초기 미션 데이터 (Lv.0 ~ Lv.5)
-- ============================================================
insert into missions (level_required, title, credit_reward, heart_reward, exp_reward, concept_tag, difficulty, repeat_type, icon_emoji) values
  -- Lv.0 씨앗 — 행동-보상 연결
  (0, '이불 개기',        1,  1,  10,  '미션', 'easy',    'daily',   '🛏️'),
  (0, '밥 먹기 완료',     1,  1,  10,  '미션', 'easy',    'daily',   '🍳'),
  (0, '손 씻기',          1,  1,  10,  '미션', 'easy',    'daily',   '🧼'),
  (0, '장난감 정리',      2,  1,  15,  '미션', 'normal',  'daily',   '🧸'),
  (0, '인사하기',         1,  1,  10,  '미션', 'easy',    'daily',   '👋'),
  (0, '옷 스스로 입기',   2,  2,  20,  '미션', 'normal',  'daily',   '👕'),

  -- Lv.1 새싹 — 교환의 개념
  (1, '동생 도와주기',        3,  1,  25,  '기여', 'normal',  'daily',   '🤝'),
  (1, '책 읽기 10분',         2,  1,  20,  '학습', 'normal',  'daily',   '📚'),
  (1, '심부름 하기',          3,  2,  25,  '미션', 'normal',  'weekly',  '🏃'),
  (1, '새 음식 먹어보기',     5,  3,  40,  '도전', 'hard',    'event',   '🍽️'),
  (1, '혼자 씻기',            3,  2,  25,  '습관', 'normal',  'daily',   '🛁'),
  (1, '일찍 자기',            2,  1,  20,  '습관', 'normal',  'daily',   '😴'),
  (1, '그림 그리기 완성',     3,  2,  25,  '학습', 'normal',  'event',   '🎨'),

  -- Lv.2 교환사 — 실물 화폐 교환
  (2, '청소 도와주기',        5,  2,  35,  '기여', 'normal',  'weekly',  '🧹'),
  (2, '독서록 쓰기',          8,  3,  50,  '학습', 'hard',    'event',   '📝'),
  (2, '운동 30분',            6,  2,  40,  '건강', 'normal',  'weekly',  '🏋️'),
  (2, '밥상 차리기 도움',     4,  2,  30,  '기여', 'normal',  'daily',   '🍚'),
  (2, '일기 쓰기',            6,  3,  40,  '학습', 'normal',  'daily',   '✏️'),
  (2, '일주일 개근 보너스',  20,  5, 100,  '습관', 'special', 'weekly',  '🎯'),

  -- Lv.3 저축왕 — 저축과 목표 설정
  (3, '목표 저금통 10% 달성', 10,  3,  60,  '저축', 'special', 'event',   '🐷'),
  (3, '스스로 공부 30분',     10,  4,  60,  '학습', 'hard',    'daily',   '📖'),
  (3, '어려운 도전 미션',     15,  5,  80,  '도전', 'hard',    'weekly',  '⚡'),
  (3, '집안일 프로젝트',      20,  7,  90,  '기여', 'hard',    'weekly',  '🏠'),
  (3, '한 달 꾸준히 달성',   50, 15, 200,  '습관', 'special', 'monthly', '🏆'),

  -- Lv.4 나눔이 — 증여와 나눔
  (4, '친구에게 크레딧 선물', 20,  8,  80,  '나눔', 'special', 'event',   '🎁'),
  (4, '기부 미션',            15, 10,  70,  '나눔', 'special', 'monthly', '🌳'),
  (4, '가족 감사 편지',       10,  5,  50,  '나눔', 'normal',  'weekly',  '💌'),
  (4, '친구 도와주기',         8,  5,  45,  '나눔', 'normal',  'event',   '🤗'),
  (4, '나눔 일기 쓰기',        8,  4,  40,  '나눔', 'normal',  'weekly',  '📓'),

  -- Lv.5 투자가 — 투자와 리스크
  (5, '투자 농장 씨앗 심기',  0,  5,  30,  '투자', 'special', 'event',   '🌱'),
  (5, '경제 퀴즈 도전',      20,  5,  80,  '학습', 'hard',    'weekly',  '🧠'),
  (5, '투자 일기 쓰기',      10,  3,  50,  '투자', 'normal',  'weekly',  '📊'),
  (5, '용돈 예산 계획 세우기',15,  6,  70,  '저축', 'hard',    'monthly', '💰'),
  (5, '가족 경제 토론 참여',  10,  5,  50,  '학습', 'normal',  'weekly',  '🗣️');
