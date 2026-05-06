-- ============================================================
-- 074_routine_mission_icons_shower_chip.sql
-- 야외놀이·실내놀이·식사 준비 돕기·밥 다 먹기 계열 아이콘 재적용
-- 일상 「샤워하기」 전역 템플릿 추가 (p.m/shower.png)
-- ============================================================

begin;

update public.missions
set icon_emoji = '/assets/img/missions/routine/p.m/paly_outside.png'
where trim(title) = '야외놀이';

update public.missions
set icon_emoji = '/assets/img/missions/routine/p.m/play_inside.png'
where trim(title) = '실내놀이';

update public.missions
set icon_emoji = '/assets/img/missions/routine/special/put_cutrary.png'
where trim(title) in (
  '식사준비돕기',
  '식사준비하기',
  '식사준비 돕기',
  '식사 준비 돕기'
);

update public.missions
set icon_emoji = '/assets/img/missions/routine/special/put_away_dishes.png'
where trim(title) in (
  '밥 다 먹기',
  '밥 다먹기',
  '밥그릇비우기',
  '밥그릇 비우기'
);

insert into public.missions (
  level_required, title, description, icon_emoji,
  credit_reward, heart_reward, exp_reward,
  concept_tag, difficulty, repeat_type, block, scheduled_time, is_active
)
select
  0,
  '샤워하기',
  '샤워로 몸을 깨끗이 해요',
  '/assets/img/missions/routine/p.m/shower.png',
  8, 1, 15,
  '건강', 'easy', 'daily', 'evening', '19:05', true
where not exists (
  select 1
  from public.missions m
  where trim(m.title) = '샤워하기'
    and m.linked_child_id is null
);

commit;

notify pgrst, 'reload schema';
