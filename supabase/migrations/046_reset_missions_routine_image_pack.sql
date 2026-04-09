-- ============================================================
-- 046_reset_missions_routine_image_pack.sql
-- 기존 미션 데이터 전체 초기화 후, 새 루틴/스페셜 미션을 이미지 경로와 함께 재구성
-- ============================================================

begin;

-- 기존 연결 데이터부터 정리 (FK 순서)
delete from public.daily_missions;
delete from public.mission_logs;
delete from public.missions;

-- ------------------------------------------------------------
-- 오전 루틴 (a.m)
-- ------------------------------------------------------------
insert into public.missions (
  level_required, title, description, icon_emoji,
  credit_reward, heart_reward, exp_reward,
  concept_tag, difficulty, repeat_type, block, scheduled_time, is_active
) values
  (0, '일어나기',         '아침에 스스로 일어나요',                    '/assets/img/missions/routine/a.m/wake_up.png',      6, 1, 12, '습관', 'easy',   'daily', 'morning', '07:00', true),
  (0, '양치하기',         '아침 양치를 꼼꼼히 해요',                    '/assets/img/missions/routine/a.m/brush_teeth.png',  6, 1, 12, '건강', 'easy',   'daily', 'morning', '07:10', true),
  (0, '아침식사',         '아침밥을 먹고 하루를 시작해요',               '/assets/img/missions/routine/a.m/breakfase.png',    8, 1, 14, '건강', 'normal', 'daily', 'morning', '07:30', true),
  (0, '물마시기',         '아침 물 한 컵을 마셔요',                      '/assets/img/missions/routine/a.m/dringking.png',    5, 1, 10, '건강', 'easy',   'daily', 'morning', '07:40', true),
  (0, '옷갈아입기',       '외출할 옷으로 갈아입어요',                    '/assets/img/missions/routine/a.m/change.png',       6, 1, 12, '습관', 'easy',   'daily', 'morning', '07:50', true),
  (0, '버스타기',         '버스를 타고 이동해요',                        '/assets/img/missions/routine/a.m/school_bus.png',   7, 1, 12, '습관', 'normal', 'daily', 'morning', '08:00', true),
  (0, '등원/등교하기',    '기관(학교)에 잘 도착해요',                    '/assets/img/missions/routine/a.m/school_bus.png',   8, 1, 14, '습관', 'normal', 'daily', 'morning', '08:10', true);

-- ------------------------------------------------------------
-- 오후 루틴 (p.m)
-- ------------------------------------------------------------
insert into public.missions (
  level_required, title, description, icon_emoji,
  credit_reward, heart_reward, exp_reward,
  concept_tag, difficulty, repeat_type, block, scheduled_time, is_active
) values
  (0, '야외놀이',         '밖에서 신나게 몸을 움직여요',                 '/assets/img/missions/routine/p.m/paly_outside.png',   9, 1, 16, '건강', 'normal', 'daily', 'afternoon', '16:00', true),
  (0, '손씻기',           '놀이 후 손을 깨끗이 씻어요',                  '/assets/img/missions/routine/p.m/wash_hand.png',      6, 1, 12, '건강', 'easy',   'daily', 'afternoon', '16:20', true),
  (0, '가방정리',         '가방 속 물건을 제자리에 정리해요',             '/assets/img/missions/routine/p.m/bag_packing.png',    7, 1, 13, '습관', 'normal', 'daily', 'afternoon', '16:40', true),
  (0, '실내놀이',         '집에서 안전하게 실내놀이를 해요',              '/assets/img/missions/routine/p.m/play_inside.png',    8, 1, 14, '습관', 'normal', 'daily', 'afternoon', '17:00', true),
  (0, '저녁식사',         '저녁밥을 먹으며 하루를 마무리해요',            '🍽️',                                                  9, 1, 15, '건강', 'normal', 'daily', 'evening',   '18:00', true),
  (0, '물마시기(저녁)',   '저녁에도 물을 챙겨 마셔요',                    '/assets/img/missions/routine/a.m/dringking.png',      5, 1, 10, '건강', 'easy',   'daily', 'evening',   '18:20', true),
  (0, '장난감정리',       '놀이한 장난감을 스스로 정리해요',              '/assets/img/missions/routine/p.m/organize_toys.png',  8, 1, 14, '습관', 'normal', 'daily', 'evening',   '18:40', true),
  (0, '씻기',             '하루를 마치며 깨끗하게 씻어요',                '/assets/img/missions/routine/p.m/shower.png',         8, 1, 15, '건강', 'normal', 'daily', 'evening',   '19:10', true),
  (0, '잠옷갈아입기',     '잠옷으로 갈아입고 잘 준비를 해요',             '/assets/img/missions/routine/p.m/pajama.png',         7, 1, 13, '습관', 'easy',   'daily', 'bedtime',   '19:30', true),
  (0, '빨래통에 옷넣기',  '벗은 옷을 빨래통에 넣어요',                    '/assets/img/missions/routine/p.m/roundrybasket.png',  7, 1, 13, '습관', 'easy',   'daily', 'bedtime',   '19:40', true),
  (0, '잠자리 독서',      '잠들기 전 짧게 책을 읽어요',                   '/assets/img/missions/routine/p.m/book.png',           8, 1, 14, '학습', 'normal', 'daily', 'bedtime',   '20:00', true),
  (0, '잠자기',           '제시간에 잠자리에 들어요',                     '/assets/img/missions/routine/p.m/goodnight.png',      9, 1, 16, '습관', 'normal', 'daily', 'bedtime',   '20:30', true);

-- ------------------------------------------------------------
-- 스페셜 미션 (special)
-- ------------------------------------------------------------
insert into public.missions (
  level_required, title, description, icon_emoji,
  credit_reward, heart_reward, exp_reward,
  concept_tag, difficulty, repeat_type, block, scheduled_time, is_active
) values
  (0, '스스로옷입기',       '도움 없이 스스로 옷을 입어요',              '/assets/img/missions/routine/special/self_change.png',      12, 1, 20, '도전', 'special', 'event', null, null, true),
  (0, '스스로양말신기',     '양말을 스스로 신어봐요',                    '/assets/img/missions/routine/special/self_socks.png',       10, 1, 18, '도전', 'special', 'event', null, null, true),
  (0, '화분에물주기',       '화분 흙 상태를 보고 물을 줘요',              '/assets/img/missions/routine/special/water_plant.png',      11, 1, 18, '기여', 'special', 'event', null, null, true),
  (0, '식사준비하기',       '식사 준비를 도와요',                         '/assets/img/missions/routine/special/put_cutrary.png',      12, 1, 20, '기여', 'special', 'event', null, null, true),
  (0, '밥그릇비우기',       '그릇의 음식을 남기지 않고 먹어요',            '/assets/img/missions/routine/special/put_away_dishes.png',  11, 1, 19, '건강', 'special', 'event', null, null, true),
  (0, '야채먹기',           '야채를 골고루 먹어요',                       '/assets/img/missions/routine/special/eat_vegitables.png',   12, 1, 20, '건강', 'special', 'event', null, null, true),
  (0, '밥먹고 정리하기',    '식사 후 자리를 정리해요',                    '/assets/img/missions/routine/special/clean_up_all.png',     12, 1, 20, '습관', 'special', 'event', null, null, true),
  (0, '분리수거하기',       '재활용을 구분해서 버려요',                    '/assets/img/missions/routine/special/sort_recycle.png',     13, 1, 22, '기여', 'special', 'event', null, null, true),
  (0, '장난감정리하기',     '놀고 난 장난감을 정리해요',                   '/assets/img/missions/routine/special/organize_toys.png',    11, 1, 18, '습관', 'special', 'event', null, null, true),
  (0, '옷 개키기',          '빨래한 옷을 개어 정리해요',                   '/assets/img/missions/routine/special/organize_cloth.png',   12, 1, 20, '습관', 'special', 'event', null, null, true),
  (0, '명상하기',           '짧게 호흡을 가다듬고 마음을 안정해요',         '/assets/img/missions/routine/special/meditation.png',       12, 1, 20, '건강', 'special', 'event', null, null, true),
  (0, '숙제하기',           '해야 할 숙제를 스스로 해요',                  '/assets/img/missions/routine/special/homework.png',         14, 1, 24, '학습', 'special', 'event', null, null, true),
  (0, '저금하기',           '쓴 돈을 확인하고 저축해요',                   '/assets/img/missions/routine/special/saving.png',           13, 1, 22, '저축', 'special', 'event', null, null, true),
  (0, '손톱깎기',           '손톱을 깔끔하게 정리해요',                    '/assets/img/missions/routine/special/nail_cliper.png',     11, 1, 19, '건강', 'special', 'event', null, null, true),
  (0, '인사잘하기',         '만나는 사람에게 먼저 인사해요',               '/assets/img/missions/routine/special/say_hello.png',        10, 1, 18, '습관', 'special', 'event', null, null, true),
  (0, '어른께인사하기',     '어른께 공손하게 인사해요',                    '/assets/img/missions/routine/special/bow_to_adult.png',     11, 1, 19, '습관', 'special', 'event', null, null, true),
  (0, '목욕하기',           '목욕으로 하루를 깨끗하게 마무리해요',          '/assets/img/missions/routine/special/bath.png',             12, 1, 20, '건강', 'special', 'event', null, null, true);

commit;

