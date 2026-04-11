-- ============================================================
-- 054_agent_tables.sql
-- AI 에이전트용 신규 테이블 3개 생성
-- ============================================================

-- 1) agent_reports — Agent A 주간 리포트 & 코칭 결과
CREATE TABLE IF NOT EXISTS agent_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start    date        NOT NULL,
  report_text   text,
  coaching_text text,
  eq_scores     jsonb,
  suggestions   jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_reports_child_id
  ON agent_reports (child_id);
CREATE INDEX IF NOT EXISTS idx_agent_reports_week_start
  ON agent_reports (child_id, week_start DESC);

-- RLS
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;

-- 부모: 자신의 자녀 리포트 읽기
CREATE POLICY "parent_read_child_report" ON agent_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_links fl
      WHERE fl.child_id = agent_reports.child_id
        AND fl.parent_id = auth.uid()
    )
  );

-- 서비스 롤: 쓰기 (에이전트 서버)
CREATE POLICY "service_insert_report" ON agent_reports
  FOR INSERT WITH CHECK (true);


-- ============================================================
-- 2) calendar_events — Agent B 파싱된 캘린더 이벤트
CREATE TABLE IF NOT EXISTS calendar_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_link_id uuid        NOT NULL REFERENCES family_links(id) ON DELETE CASCADE,
  event_type     text        NOT NULL
                             CHECK (event_type IN ('holiday','vacation','travel','birthday','etc')),
  title          text        NOT NULL,
  start_date     date        NOT NULL,
  end_date       date,
  input_type     text        NOT NULL DEFAULT 'text'
                             CHECK (input_type IN ('text','image')),
  raw_input      text,
  parsed_by_ai   boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_family
  ON calendar_events (family_link_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates
  ON calendar_events (start_date, end_date);

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_read_calendar" ON calendar_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_links fl
      WHERE fl.id = calendar_events.family_link_id
        AND fl.parent_id = auth.uid()
    )
  );

CREATE POLICY "service_insert_calendar" ON calendar_events
  FOR INSERT WITH CHECK (true);


-- ============================================================
-- 3) agent_suggestions — Agent B 루틴 조정 제안
CREATE TABLE IF NOT EXISTS agent_suggestions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id            uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  calendar_event_id   uuid        REFERENCES calendar_events(id) ON DELETE SET NULL,
  suggestion_type     text        NOT NULL
                                  CHECK (suggestion_type IN ('routine_off','special_mission','extra_reward')),
  suggestion_detail   jsonb,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','rejected')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_suggestions_child
  ON agent_suggestions (child_id);
CREATE INDEX IF NOT EXISTS idx_agent_suggestions_status
  ON agent_suggestions (child_id, status);

-- RLS
ALTER TABLE agent_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_manage_suggestion" ON agent_suggestions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM family_links fl
      WHERE fl.child_id = agent_suggestions.child_id
        AND fl.parent_id = auth.uid()
    )
  );

CREATE POLICY "service_insert_suggestion" ON agent_suggestions
  FOR INSERT WITH CHECK (true);
