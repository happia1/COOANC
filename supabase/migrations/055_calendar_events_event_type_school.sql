-- 학사일정표 등에서 추출한 `school` 유형을 DB에 저장할 수 있도록 허용 값을 확장합니다.
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_event_type_check
  CHECK (
    event_type IN ('holiday', 'vacation', 'travel', 'birthday', 'etc', 'school')
  );
