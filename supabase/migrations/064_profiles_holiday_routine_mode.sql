-- ============================================================
-- 064_profiles_holiday_routine_mode.sql
-- 휴일 루틴 "평일과 같음" vs "휴일만 따로" — 주말 daily_missions 백필 판단용
-- repeat_type=weekly 이 0개일 때(휴일 칩 비움)도 custom 을 DB 에 남깁니다.
-- ============================================================

alter table public.profiles
  add column if not exists holiday_routine_mode text
  check (
    holiday_routine_mode is null
    or holiday_routine_mode in ('as_weekday', 'custom')
  );

comment on column public.profiles.holiday_routine_mode is
  '자녀( role=child )만 사용. as_weekday=주말에도 평일(daily) 템플릿, custom=주말은 weekly 풀만(없으면 백필 없음)';
