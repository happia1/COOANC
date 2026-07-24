-- ============================================================
-- 120_missions_active_unique_guard.sql
-- 미션 템플릿 중복 방지
--
-- 문제: 온보딩·루틴 재설정을 반복 실행하면 /api/mission/create 가
--   같은 제목의 활성 템플릿을 계속 INSERT → "기상" 12개 등 대량 중복.
--   중복 템플릿마다 daily_missions 행이 생성되어 하루 미션이 부풀어남.
--
-- 해결:
--   1) 활성 템플릿 중복 정리 (같은 제목·블록·자녀범위 → 최신 1개만 유지)
--   2) 부분 유니크 인덱스 — 활성(is_active=true) 행에만 적용되므로
--      비활성 이력 행은 자유롭게 쌓일 수 있음
--   3) 비활성화된 템플릿의 미완료 daily_missions 정리
-- ============================================================

-- 1) 활성 템플릿 중복 정리 (완료 기록 보존을 위해 삭제 대신 비활성화)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY title, coalesce(block, ''), coalesce(linked_child_id::text, 'global')
    ORDER BY created_at DESC
  ) AS rn
  FROM public.missions
  WHERE is_active = true
)
UPDATE public.missions SET is_active = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) 활성 템플릿 유니크 인덱스: 같은 (제목, 블록, 자녀범위)의 활성 행은 1개만 허용
CREATE UNIQUE INDEX IF NOT EXISTS missions_active_title_block_scope_key
  ON public.missions (title, coalesce(block, ''), coalesce(linked_child_id::text, 'global'))
  WHERE is_active = true;

-- 3) 비활성 템플릿의 미완료 daily_missions 정리 (완료된 행은 보상 기록이므로 유지)
DELETE FROM public.daily_missions dm
USING public.missions m
WHERE dm.mission_template_id = m.id
  AND m.is_active = false
  AND dm.is_completed = false
  AND dm.date >= CURRENT_DATE - 1;
