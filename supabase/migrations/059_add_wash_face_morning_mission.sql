/**
 * 059_add_wash_face_morning_mission.sql
 *
 * 오전 루틴 템플릿에 「세수하기」 미션을 추가합니다.
 * - 이미지: /assets/img/missions/routine/a.m/wash_face.png
 * - 기존 「세수」 제목으로 잘못 들어간 행이 있다면 제목·이미지를 함께 정정합니다.
 */

-- 기존에 「세수」 제목으로 등록된 전역 템플릿 미션(linked_child_id 없는 행)이 있으면
-- 제목을 「세수하기」로, 이미지를 올바른 경로로 업데이트합니다.
update public.missions
set
  title      = '세수하기',
  icon_emoji = '/assets/img/missions/routine/a.m/wash_face.png'
where
  title           = '세수'
  and linked_child_id is null;

-- 아직 「세수하기」 템플릿이 없을 경우에만 새로 삽입합니다.
insert into public.missions (
  level_required, title, description, icon_emoji,
  credit_reward, heart_reward, exp_reward,
  concept_tag, difficulty, repeat_type, block, scheduled_time, is_active
)
select
  0,
  '세수하기',
  '아침에 일어난 뒤 세수해요',
  '/assets/img/missions/routine/a.m/wash_face.png',
  6, 1, 12,
  '건강', 'easy', 'daily', 'morning', '07:05', true
where not exists (
  select 1
  from public.missions
  where title = '세수하기'
    and linked_child_id is null
);
