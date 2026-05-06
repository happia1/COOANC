-- ============================================================
-- 075_meal_cleanup_icons_and_after_meal_mission.sql
-- 「밥 다 먹기」→ clean_up_all.png
-- 「식사 후 정리하기」스페셜 템플릿 추가 → put_away_dishes.png
-- 「식사 준비 돕기」계열 → put_cutrary.png (재적용)
-- (074에서 밥 다 먹기 행에 잘못 넣었던 put_away_dishes 되돌림)
-- ============================================================

begin;

update public.missions
set icon_emoji = '/assets/img/missions/routine/special/clean_up_all.png'
where trim(title) in ('밥 다 먹기', '밥 다먹기');

update public.missions
set icon_emoji = '/assets/img/missions/routine/special/put_cutrary.png'
where trim(title) in (
  '식사준비돕기',
  '식사준비하기',
  '식사준비 돕기',
  '식사 준비 돕기'
);

-- 예전 제목을 새 칩 제목으로 맞춤
update public.missions
set
  title = '식사 후 정리하기',
  icon_emoji = '/assets/img/missions/routine/special/put_away_dishes.png'
where trim(title) in ('식사후 정리', '식사 후 정리', '식사후정리');

insert into public.missions (
  level_required, title, description, icon_emoji,
  credit_reward, heart_reward, exp_reward,
  concept_tag, difficulty, repeat_type, block, scheduled_time, is_active
)
select
  0,
  '식사 후 정리하기',
  '식사가 끝나면 그릇과 식탁을 정리해요',
  '/assets/img/missions/routine/special/put_away_dishes.png',
  12, 1, 20,
  '습관', 'special', 'event', null, null, true
where not exists (
  select 1
  from public.missions m
  where trim(m.title) = '식사 후 정리하기'
    and m.linked_child_id is null
);

commit;

notify pgrst, 'reload schema';
