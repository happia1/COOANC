-- ============================================================
-- 126_calendar_events_description.sql
-- 캘린더 「간단한 설명」이 기기 간에 동기화되지 않던 문제
--
-- 문제: 일정 시트의 description(간단한 설명)은 localStorage 에만 저장되고
--   calendar_events 테이블에는 칼럼 자체가 없었습니다(054 정의에 없음).
--   그래서 노트북에서 쓴 설명이 모바일·패드에서는 보이지 않았습니다.
--
-- 해결: 설명도 DB 에 저장해 「DB 가 기준」이 되도록 칼럼을 추가합니다.
--   앱은 이 칼럼이 없는 DB 에서도 동작하도록 되어 있지만(설명만 기기 전용으로 남음),
--   이 마이그레이션을 적용하면 설명까지 모든 기기에서 같아집니다.
--
-- 실행 후 확인:
--   한 기기에서 일정 설명을 저장한 뒤
--   select id, title, description from public.calendar_events
--    where description is not null and description <> '';
--   → 행이 보이면 정상. 다른 기기에서도 같은 설명이 보입니다.
-- ============================================================

alter table public.calendar_events
  add column if not exists description text;

comment on column public.calendar_events.description is
  '일정 시트의 「간단한 설명」. 빈 문자열은 사용자가 설명을 지운 상태를 뜻합니다(기기 간 동기화용).';

-- PostgREST 스키마 캐시 갱신 — 빠지면 칼럼이 있어도 PGRST204 가 납니다.
notify pgrst, 'reload schema';
