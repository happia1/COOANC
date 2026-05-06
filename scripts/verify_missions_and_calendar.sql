-- ============================================================
-- 개발·운영 점검용 — Supabase SQL 편집기에서 단계적으로 실행하세요.
-- 비개발자: 아래 결과로 「DB에 있는 미션」과 「자녀별 연결」이 맞는지 볼 수 있습니다.
-- ============================================================

-- 1) 공용 풀(linked_child_id 가 비어 있음) vs 자녀 전용 미션 개수
select
  case when linked_child_id is null then '공용 풀' else '자녀 전용' end as 구분,
  count(*)::int as 행수
from public.missions
group by 1
order by 1;

-- 2) 자녀별 미션 템플릿 — 오늘 daily_missions 와 직접 비교할 때 씁니다
--    (실제 child_id·날짜는 환경에 맞게 바꿔 주세요)
-- select id, title, linked_child_id, repeat_type, sort_order, is_active
-- from public.missions
-- where linked_child_id = '자녀-uuid'
-- order by sort_order, scheduled_time nulls last;

-- 3) calendar_events — family_link 별 최근 일정 개수(분산 저장 여부 1차 확인)
select family_link_id::text, count(*)::int as 일정수
from public.calendar_events
group by family_link_id
order by 일정수 desc
limit 30;
