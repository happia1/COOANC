-- ============================================================
-- 135_room_decoration_seed.sql — 방꾸미기 카탈로그 시드
--
-- ⚠️ 전부 is_active = false 로 넣습니다.
--    이름·가격·해금 레벨은 **임시값**이며, 실제 그림과 기획이 확정되면 교체할 예정입니다.
--    화면에는 is_active = true 인 것만 나오므로 켜기 전까지 아무 영향이 없습니다.
--
--    공개 준비가 되면 이렇게 켭니다:
--      update public.room_items set is_active = true where name = '벽지A';
--
--    이름으로 다시 넣어도 중복되지 않도록, 같은 이름이 있으면 건너뜁니다.
-- ============================================================

insert into public.room_items
  (name, category, scene_type, fixed_slot_key, unlock_level, price_credits, description, feature_key, sort_order, is_active)
select v.name, v.category, v.scene_type, v.fixed_slot_key, v.unlock_level, v.price_credits, v.description, v.feature_key, v.sort_order, false
from (values
  -- ── 배경(벽지) — 실내/야외 구분 없음 ──────────────────────
  ('벽지A',      'background', null,      null, 0,  50,  null, null, 10),
  ('벽지B',      'background', null,      null, 3,  80,  null, null, 11),
  ('벽지C',      'background', null,      null, 6,  100, null, null, 12),

  -- ── 배경(장면) — 실내 ────────────────────────────────────
  ('실내배경A',  'background', 'indoor',  null, 8,  120, null, null, 20),
  ('실내배경B',  'background', 'indoor',  null, 10, 150, null, null, 21),

  -- ── 배경(장면) — 야외 ────────────────────────────────────
  ('야외배경A',  'background', 'outdoor', null, 8,  120, null, null, 30),
  ('야외배경B',  'background', 'outdoor', null, 10, 150, null, null, 31),
  ('야외배경C',  'background', 'outdoor', null, 12, 180, null, null, 32),

  -- ── 바닥 ─────────────────────────────────────────────────
  ('바닥A',      'floor',      null,      null, 0,  50,  null, null, 40),
  ('바닥B',      'floor',      null,      null, 3,  80,  null, null, 41),
  ('바닥C',      'floor',      null,      null, 6,  100, null, null, 42),

  -- ── 러그 ─────────────────────────────────────────────────
  ('러그A',      'rug',        null,      null, 4,  70,  null, null, 50),
  ('러그B',      'rug',        null,      null, 7,  90,  null, null, 51),

  -- ── 기능형 — 사면 홈 화면 정해진 자리에 놓을 수 있습니다 ──
  ('크레용 세트',   'prop',      null, 'slot_crayon',    5, 90,  '일기장에 낙서를 할 수 있어요',        'diary_doodle',        60),
  ('피크닉 바구니', 'furniture', null, 'slot_basket',    5, 100, '수확한 과일을 모아 구경할 수 있어요', 'harvest_basket',      61),
  ('모빌',         'prop',      null, 'slot_mobile',    6, 100, '오늘 기분을 표정과 색으로 기록해요',   'emotion_card_mobile', 62),
  ('종이비행기',    'prop',      null, 'slot_airplane',  6, 80,  '엄마·친구에게 쪽지를 보내요',         'message_note',        63),
  ('트로피',       'prop',      null, 'slot_trophy',    9, 100, '친구들과 순위를 확인해요',            'social_shortcut',     64),
  ('액자',         'furniture', null, 'slot_frame',     9, 120, '사진을 찍어 액자에 담아요',           'camera_frame',        65),

  -- ── 컨셉 단계 — 레벨·가격 미정이라 맨 뒤에 둡니다 ─────────
  ('책꽂이',       'furniture', null, 'slot_bookshelf', null, null, null, 'story_reader', 90)
) as v(name, category, scene_type, fixed_slot_key, unlock_level, price_credits, description, feature_key, sort_order)
where not exists (
  select 1 from public.room_items existing where existing.name = v.name
);

notify pgrst, 'reload schema';
