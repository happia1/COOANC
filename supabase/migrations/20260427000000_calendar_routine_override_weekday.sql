-- calendar_events.routine_override 에 'weekday' 추가 (주중 루틴 강제)
-- 기존: ('weekend','none') — PostgreSQL 이 생성한 check 제약 이름이 환경마다 다를 수 있어 기본 이름·대체 둘 다 시도
alter table calendar_events
  drop constraint if exists calendar_events_routine_override_check;

alter table calendar_events
  add constraint calendar_events_routine_override_check
  check (routine_override in ('weekend', 'none', 'weekday'));
