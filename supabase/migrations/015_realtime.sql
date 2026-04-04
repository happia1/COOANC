-- ============================================================
-- 015_realtime.sql
-- Supabase Realtime 활성화 (3개 테이블만)
-- 가드레일: 이 3개 테이블 외 Realtime 구독 금지
-- ============================================================

alter publication supabase_realtime add table mission_logs;
alter publication supabase_realtime add table purchase_requests;
alter publication supabase_realtime add table child_stats;
