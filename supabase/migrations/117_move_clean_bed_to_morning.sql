-- ============================================================
-- 117_move_clean_bed_to_morning.sql
--
-- 이불 정리하기를 스페셜 → 오전 일상(morning)으로 이동
-- (앱 `routineChips.ts` AM_CHIPS · 기상 다음 순서와 동기화)
-- ============================================================

begin;

-- 1) 스페셜/이벤트로 남아 있는 이불 정리 미션 → 오전 일상 템플릿으로 전환
update public.missions m
set
  title = '이불 정리하기',
  difficulty = 'easy',
  block = 'morning',
  repeat_type = case when m.repeat_type = 'weekly' then 'weekly' else 'daily' end,
  concept_tag = coalesce(m.concept_tag, '생활'),
  icon_emoji = '/assets/img/missions/routine/special/clean_bed.png',
  scheduled_time = coalesce(m.scheduled_time, '07:02')
where btrim(m.title) in (
  '이불 정리하기',
  '이불정리하기',
  '이불개기',
  '이불 개기'
)
  and (m.repeat_type = 'event' or m.difficulty = 'special');

-- 2) 전역 풀(linked_child_id null) — 없으면 오전 템플릿 삽입
insert into public.missions (
  level_required, title, description, icon_emoji,
  credit_reward, heart_reward, exp_reward,
  concept_tag, difficulty, repeat_type, block, scheduled_time, is_active
)
select
  0,
  '이불 정리하기',
  '이불과 베개를 예쁘게 정리해요',
  '/assets/img/missions/routine/special/clean_bed.png',
  6, 1, 12,
  '생활', 'easy', 'daily', 'morning', '07:02', true
where not exists (
  select 1
  from public.missions g
  where g.linked_child_id is null
    and btrim(g.title) = '이불 정리하기'
    and g.block = 'morning'
    and g.difficulty = 'easy'
);

-- 3) 자녀 연결 템플릿 중복(스페셜 잔여 + 오전 일상) 정리 — 오전 일상 행만 남김
delete from public.missions del
using public.missions keep
where del.id <> keep.id
  and del.linked_child_id is not null
  and keep.linked_child_id is not null
  and del.linked_child_id = keep.linked_child_id
  and btrim(del.title) in ('이불 정리하기', '이불정리하기', '이불개기', '이불 개기')
  and btrim(keep.title) = '이불 정리하기'
  and keep.block = 'morning'
  and keep.difficulty = 'easy'
  and (del.difficulty = 'special' or del.repeat_type = 'event');

commit;
