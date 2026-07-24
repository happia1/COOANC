-- ============================================================
-- 120_missions_active_unique_guard.sql
-- 미션 템플릿 중복 방지 (daily_missions 안전 재연결 포함)
--
-- 문제: 온보딩·루틴 재설정을 반복하면 /api/mission/create 가
--   같은 제목의 활성 템플릿을 계속 INSERT → "기상" 12개 등 대량 중복.
--   중복 템플릿마다 daily_missions 행이 생성되어 하루 미션이 부풀어남.
--
-- 주의: 단순히 중복 템플릿을 비활성화하면, 오늘 이미 배정된 daily_missions 가
--   비활성 템플릿을 참조하게 되어 자녀 화면 풀 필터에서 사라질 수 있음.
--   → 비활성화 "전에" daily_missions 를 canonical(최신) 템플릿으로 재연결한다.
-- ============================================================

-- 1) 오늘 이후 daily_missions 를 canonical(그룹 내 최신) 템플릿으로 재연결
WITH grp AS (
  SELECT id, title,
         coalesce(block, '')                       AS blk,
         coalesce(linked_child_id::text, 'global')  AS scope,
         row_number() OVER (
           PARTITION BY title, coalesce(block, ''), coalesce(linked_child_id::text, 'global')
           ORDER BY created_at DESC
         ) AS rn
  FROM public.missions
  WHERE is_active = true
),
canon AS (SELECT title, blk, scope, id AS canon_id FROM grp WHERE rn = 1),
dups AS (
  SELECT g.id AS dup_id, c.canon_id
  FROM grp g
  JOIN canon c ON c.title = g.title AND c.blk = g.blk AND c.scope = g.scope
  WHERE g.rn > 1
)
UPDATE public.daily_missions dm
SET mission_template_id = d.canon_id
FROM dups d
WHERE dm.mission_template_id = d.dup_id
  AND dm.date >= CURRENT_DATE
  AND NOT EXISTS (   -- 같은 자녀·날짜에 canonical 행이 이미 있으면 재연결 생략(유니크 충돌 방지)
    SELECT 1 FROM public.daily_missions d2
    WHERE d2.child_id = dm.child_id
      AND d2.date = dm.date
      AND d2.mission_template_id = d.canon_id
  );

-- 2) canonical 이 아닌 중복 활성 템플릿 비활성화 (완료 이력 보존 위해 삭제 대신 비활성화)
WITH grp AS (
  SELECT id, row_number() OVER (
           PARTITION BY title, coalesce(block, ''), coalesce(linked_child_id::text, 'global')
           ORDER BY created_at DESC
         ) AS rn
  FROM public.missions
  WHERE is_active = true
)
UPDATE public.missions SET is_active = false
WHERE id IN (SELECT id FROM grp WHERE rn > 1);

-- 3) 활성 템플릿 유니크 인덱스: 같은 (제목, 블록, 자녀범위)의 활성 행은 1개만 허용
CREATE UNIQUE INDEX IF NOT EXISTS missions_active_title_block_scope_key
  ON public.missions (title, coalesce(block, ''), coalesce(linked_child_id::text, 'global'))
  WHERE is_active = true;

-- 4) 재연결 못 한(=이미 canonical 행이 있어 중복인) 비활성-참조 미완료 행 정리
DELETE FROM public.daily_missions dm
USING public.missions m
WHERE dm.mission_template_id = m.id
  AND m.is_active = false
  AND dm.date >= CURRENT_DATE
  AND dm.is_completed = false;
