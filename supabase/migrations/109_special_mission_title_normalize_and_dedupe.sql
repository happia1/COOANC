-- ============================================================
-- 109_special_mission_title_normalize_and_dedupe.sql
--
-- 스페셜 미션 제목·중복·고아 템플릿 정리
-- (앱 `specialMissionChips.ts` SPECIAL_MISSION_CHIPS · LEGACY 매핑과 동기화)
--
-- 정책:
-- - 「빨래정리」와 「외투걸어놓기」는 별개 칩 (050 에서 잘못 합쳐진 매핑 복구)
-- - 칩 목록에 없는 스페셜·이벤트 템플릿은 모두 삭제
-- - 「기도하기」는 스페셜 전용 (전역·자녀 연결 모두 difficulty = special)
-- ============================================================

begin;

-- ----------------------------------------------------------------
-- 1) 레거시·공백·옛 표기 → 현재 칩 제목으로 통일
--    ※ 빨래정리 ↔ 외투걸어놓기 는 서로 합치지 않음
-- ----------------------------------------------------------------
update public.missions m
set title = case btrim(m.title)
  when '기도' then '기도하기'
  when '식사준비' then '식사준비 돕기'
  when '식사준비하기' then '식사준비 돕기'
  when '식사준비돕기' then '식사준비 돕기'
  when '식사 준비 돕기' then '식사준비 돕기'
  when '인사' then '인사잘하기'
  when '인사 잘하기' then '인사잘하기'
  when '화분에물주기' then '화분 물주기'
  when '저금하기' then '저축하기'
  when '옷 개키기' then '빨래개기'
  when '부모님 어깨 주물러드리기' then '어깨마사지'
  when '어깨' then '어깨마사지'
  when '분리수거하기' then '분리수거'
  when '빨래통에 넣기' then '빨래통에넣기'
  when '외투 걸어두기' then '외투걸어놓기'
  when '빨래 정리' then '빨래정리'
  when '밥 다먹기' then '밥 다 먹기'
  when '밥그릇비우기' then '밥 다 먹기'
  when '밥그릇 비우기' then '밥 다 먹기'
  when '식사후정리' then '식사 후 정리하기'
  when '식사후 정리' then '식사 후 정리하기'
  when '식사 후 정리' then '식사 후 정리하기'
  when '이불개기' then '이불 정리하기'
  when '이불 개기' then '이불 정리하기'
  when '이불정리하기' then '이불 정리하기'
  when '머리 빗기' then '머리빗기'
  when '로션 바르기' then '로션바르기'
  else m.title
end
where (m.repeat_type = 'event' or m.difficulty = 'special')
  and btrim(m.title) in (
    '기도',
    '식사준비', '식사준비하기', '식사준비돕기', '식사 준비 돕기',
    '인사', '인사 잘하기',
    '화분에물주기',
    '저금하기',
    '옷 개키기',
    '부모님 어깨 주물러드리기', '어깨',
    '분리수거하기',
    '빨래통에 넣기',
    '외투 걸어두기',
    '빨래 정리',
    '밥 다먹기', '밥그릇비우기', '밥그릇 비우기',
    '식사후정리', '식사후 정리', '식사 후 정리',
    '이불개기', '이불 개기', '이불정리하기',
    '머리 빗기', '로션 바르기'
  );

-- ----------------------------------------------------------------
-- 2) 050 오류 복구: 「밥 다먹기」→「식사 후 정리하기」로 잘못 바뀐 행
-- ----------------------------------------------------------------
update public.missions
set
  title = '밥 다 먹기',
  icon_emoji = '/assets/img/missions/routine/special/clean_up_all.png'
where btrim(title) = '식사 후 정리하기'
  and (
    icon_emoji like '%clean_up_all%'
    or icon_emoji like '%/special/clean_up_all.png%'
  );

-- ----------------------------------------------------------------
-- 3) 기도하기 — 스페셜 전용 (linked 여부·repeat_type 무관, 전 행 통일)
-- ----------------------------------------------------------------
update public.missions
set
  title = '기도하기',
  difficulty = 'special',
  icon_emoji = '/assets/img/missions/routine/special/pray.png'
where regexp_replace(btrim(title), '\s', '', 'g') in ('기도', '기도하기');

-- ----------------------------------------------------------------
-- 4) 칩에 없는 스페셜·이벤트 템플릿 삭제 (자녀 연결 + 전역 풀)
--    daily_missions·mission_logs 는 FK CASCADE
-- ----------------------------------------------------------------
delete from public.missions m
where (m.repeat_type = 'event' or m.difficulty = 'special')
  and btrim(m.title) not in (
    '식사준비 돕기',
    '인사잘하기',
    '기도하기',
    '어깨마사지',
    '분리수거',
    '운동하기',
    '화분 물주기',
    '저축하기',
    '빨래개기',
    '명상하기',
    '숙제하기',
    '야채먹기',
    '밥 다 먹기',
    '식사 후 정리하기',
    '빨래통에넣기',
    '빨래정리',
    '외투걸어놓기',
    '손톱깎기',
    '머리빗기',
    '이불 정리하기',
    '가글하기',
    '로션바르기'
  );

-- ----------------------------------------------------------------
-- 5) 같은 자녀·같은 칩 제목 중복 → 1건만 (daily > event > 활성)
-- ----------------------------------------------------------------
with special_linked as (
  select m.id
  from public.missions m
  where m.linked_child_id is not null
    and (m.repeat_type = 'event' or m.difficulty = 'special')
    and btrim(m.title) in (
      '식사준비 돕기',
      '인사잘하기',
      '기도하기',
      '어깨마사지',
      '분리수거',
      '운동하기',
      '화분 물주기',
      '저축하기',
      '빨래개기',
      '명상하기',
      '숙제하기',
      '야채먹기',
      '밥 다 먹기',
      '식사 후 정리하기',
      '빨래통에넣기',
      '빨래정리',
      '외투걸어놓기',
      '손톱깎기',
      '머리빗기',
      '이불 정리하기',
      '가글하기',
      '로션바르기'
    )
),
ranked as (
  select
    s.id,
    row_number() over (
      partition by m.linked_child_id, btrim(m.title)
      order by
        case when m.repeat_type = 'daily' then 0 else 1 end,
        case when m.is_active then 0 else 1 end,
        m.id asc
    ) as rn
  from special_linked s
  join public.missions m on m.id = s.id
)
delete from public.missions target
using ranked r
where target.id = r.id
  and r.rn > 1;

commit;

notify pgrst, 'reload schema';
