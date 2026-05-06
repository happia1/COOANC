-- 자녀가 「오늘 미션 전부 완료 → 수면 모드」로 들어간 날(서울 달력).
-- 그날짜에 한해 부모의 미션 롤백(다시하기)을 막습니다.
alter table public.child_stats
  add column if not exists sleep_session_locked_date date;

comment on column public.child_stats.sleep_session_locked_date is
  '서울 기준 YYYY-MM-DD: 해당 날 전부 완주 후 수면 화면에 들어간 날(그날 롤백 불가)';
