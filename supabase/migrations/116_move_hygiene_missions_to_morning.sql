-- ============================================================
-- 116_move_hygiene_missions_to_morning.sql
--
-- 가글하기·로션(선크림)바르기·머리빗기를 스페셜 → 오전 일상(morning)으로 이동
-- (앱 `routineChips.ts` AM_CHIPS · 양치 다음 순서와 동기화)
-- ============================================================

begin;

-- 1) 스페셜/이벤트로 남아 있는 위생 미션 → 오전 일상 템플릿으로 전환
update public.missions m
set
  title = case btrim(m.title)
    when '로션바르기' then '로션(선크림)바르기'
    when '로션 바르기' then '로션(선크림)바르기'
    when '머리 빗기' then '머리빗기'
    else btrim(m.title)
  end,
  difficulty = 'easy',
  block = 'morning',
  repeat_type = case when m.repeat_type = 'weekly' then 'weekly' else 'daily' end,
  concept_tag = coalesce(m.concept_tag, '건강'),
  icon_emoji = case btrim(m.title)
    when '가글하기' then '/assets/img/missions/routine/special/gargle.png'
    when '머리빗기' then '/assets/img/missions/routine/special/comb_hair.png'
    when '머리 빗기' then '/assets/img/missions/routine/special/comb_hair.png'
    when '로션바르기' then '/assets/img/missions/routine/special/lotion.png'
    when '로션 바르기' then '/assets/img/missions/routine/special/lotion.png'
    else m.icon_emoji
  end,
  scheduled_time = coalesce(
    m.scheduled_time,
    case btrim(m.title)
      when '가글하기' then '07:12'
      when '로션바르기' then '07:14'
      when '로션 바르기' then '07:14'
      when '머리빗기' then '07:16'
      when '머리 빗기' then '07:16'
      else m.scheduled_time
    end
  )
where btrim(m.title) in (
  '가글하기',
  '머리빗기',
  '머리 빗기',
  '로션바르기',
  '로션 바르기'
)
  and (m.repeat_type = 'event' or m.difficulty = 'special');

-- 2) 전역 풀(linked_child_id null) — 없으면 오전 템플릿 삽입
insert into public.missions (
  level_required, title, description, icon_emoji,
  credit_reward, heart_reward, exp_reward,
  concept_tag, difficulty, repeat_type, block, scheduled_time, is_active
)
select * from (
  values
    (
      0::int,
      '가글하기'::text,
      '가글로 입안을 깨끗이 헹궈요'::text,
      '/assets/img/missions/routine/special/gargle.png'::text,
      6, 1, 12,
      '건강'::text, 'easy'::text, 'daily'::text, 'morning'::text, '07:12'::text, true
    ),
    (
      0,
      '로션(선크림)바르기',
      '피부가 건조하지 않게 로션(선크림)을 발라요',
      '/assets/img/missions/routine/special/lotion.png',
      6, 1, 12,
      '건강', 'easy', 'daily', 'morning', '07:14', true
    ),
    (
      0,
      '머리빗기',
      '머리를 가지런히 빗어 정리해요',
      '/assets/img/missions/routine/special/comb_hair.png',
      6, 1, 12,
      '건강', 'easy', 'daily', 'morning', '07:16', true
    )
) as v(
  level_required, title, description, icon_emoji,
  credit_reward, heart_reward, exp_reward,
  concept_tag, difficulty, repeat_type, block, scheduled_time, is_active
)
where not exists (
  select 1
  from public.missions m
  where m.linked_child_id is null
    and btrim(m.title) = v.title
);

-- 3) 같은 자녀·같은 제목·블록·반복 주기 중복 제거 (변환 후 2건 이상)
with routine_linked as (
  select m.id
  from public.missions m
  where m.linked_child_id is not null
    and m.block = 'morning'
    and btrim(m.title) in ('가글하기', '로션(선크림)바르기', '머리빗기')
),
ranked as (
  select
    r.id,
    row_number() over (
      partition by m.linked_child_id, btrim(m.title), m.block, m.repeat_type
      order by
        case when m.is_active then 0 else 1 end,
        m.id asc
    ) as rn
  from routine_linked r
  join public.missions m on m.id = r.id
)
delete from public.missions target
using ranked r
where target.id = r.id
  and r.rn > 1;

commit;

notify pgrst, 'reload schema';
