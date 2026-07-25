-- ============================================================
-- 125_repair_profiles_holiday_routine_mode.sql
-- 「미션 수정하기 → 수정 완료」 시 콘솔 에러 수정 (PGRST204)
--
-- 증상:
--   [postRoutineKeywordMissions] holiday_routine_mode 저장 실패
--   {"error":"초기 루틴 저장에 필요한 DB 칼럼이 없거나 스키마 캐시가 맞지 않아요 …
--     (오류 코드: PGRST204)"}
--
-- 원인:
--   PGRST204 = PostgREST 가 요청 본문의 칼럼을 스키마 캐시에서 못 찾음.
--   이 프로젝트 DB 에 064(profiles.holiday_routine_mode) / 024(profiles·missions 누락 칼럼)
--   가 적용되지 않았거나, 적용됐어도 스키마 캐시가 갱신되지 않은 상태입니다.
--   (123→124 에서 child_stats.routine_alarm_prefs 가 겪은 것과 같은 계열의 문제)
--
-- 영향:
--   루틴 카드 자체는 정상 생성되지만(사용자가 본 대로), 휴일 루틴 의도
--   (평일과 같아요 / 휴일만 따로)가 DB 에 저장되지 않습니다.
--   → 주말 daily_missions 백필이 잘못된 템플릿을 붙일 수 있어 기능상 실제 버그입니다.
--
-- 해결:
--   에러 메시지가 지목하는 064·024 칼럼을 모두 멱등(IF NOT EXISTS)으로 다시 보장하고,
--   PostgREST 스키마 캐시를 갱신합니다. 이미 있는 칼럼은 건드리지 않으므로
--   여러 번 실행해도 안전합니다.
--
-- 실행 후 확인:
--   부모 앱 → 미션 수정하기 → 휴일 루틴 선택 → 수정 완료 → 콘솔 에러 없음.
--   select id, holiday_routine_mode from public.profiles
--    where holiday_routine_mode is not null;
--   → 방금 설정한 자녀 행이 as_weekday / custom 으로 보이면 정상입니다.
-- ============================================================

-- 064: 휴일 루틴 모드 (주말 백필이 daily 를 쓸지 weekly 만 쓸지 판단)
alter table public.profiles
  add column if not exists holiday_routine_mode text;

-- 값 제약은 칼럼이 이미 있던 DB 에도 걸리도록 별도로 보장합니다.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and conname = 'profiles_holiday_routine_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_holiday_routine_mode_check
      check (
        holiday_routine_mode is null
        or holiday_routine_mode in ('as_weekday', 'custom')
      );
  end if;
end $$;

comment on column public.profiles.holiday_routine_mode is
  '자녀( role=child )만 사용. as_weekday=주말에도 평일(daily) 템플릿, custom=주말은 weekly 풀만(없으면 백필 없음)';

-- 024: 같은 에러 메시지가 함께 지목하는 누락 칼럼들도 멱등 보장
alter table public.profiles
  add column if not exists age integer,
  add column if not exists birth_date date,
  add column if not exists age_group text,
  add column if not exists institution_type text,
  add column if not exists academies jsonb default '[]'::jsonb,
  add column if not exists wake_time time,
  add column if not exists sleep_time time,
  add column if not exists alarm_enabled boolean default false;

alter table public.missions
  add column if not exists block text,
  add column if not exists scheduled_time time,
  add column if not exists scope text default 'both';

-- PostgREST 스키마 캐시 갱신 — 이게 빠지면 칼럼이 있어도 PGRST204 가 계속 납니다.
notify pgrst, 'reload schema';
