-- public 스키마 테이블 목록 확인 (Supabase SQL Editor 등에서 실행)
-- 자녀·미션 관련 예시: profiles, missions, daily_missions, mission_logs, family_links, child_stats

select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
