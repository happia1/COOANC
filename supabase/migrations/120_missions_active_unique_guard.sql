-- ============================================================
-- 120: (철회) 미션 템플릿 DB 레벨 dedup 되돌리기
--
-- 배경: 이 앱은 표시 시점에 중복 미션을 자동으로 합칩니다.
--   · 부모: dedupeLinkedRoutineMissionsByCanonicalKey (RoutineTab)
--   · 자녀: dedupeDailyRoutineMissionsByCanonicalKey (ChildScreen)
--   키 = (정규화 제목, block, repeat_type). 따라서 DB 에 중복 템플릿이 있어도
--   화면에는 1개로 보이도록 설계돼 있습니다.
--
--   앞선 120 버전은 중복 템플릿을 is_active=false 로 비활성화하고 활성 유니크
--   인덱스를 걸었는데, 이는 표시-dedup 설계와 충돌했습니다:
--     · 그룹이 (활성1 + 비활성N) 혼합이 되며 표시-dedup 이 비활성 쪽을 대표로 골라
--       부모 「일상 미션」이 비고 「비활성 미션」 섹션이 생김
--     · 활성 유니크 인덱스가 같은 제목의 평일(daily)/주말(weekly) 공존을 막아
--       키워드로 일상 미션 추가가 실패함
--
-- 결론: DB dedup 을 철회하고 표시-dedup 에 위임한다. (idempotent — 재실행 안전)
-- ============================================================

-- 1) 활성 유니크 인덱스 제거 (미션 추가 실패 원인 제거)
DROP INDEX IF EXISTS public.missions_active_title_block_scope_key;

-- 2) 앞선 dedup 이 비활성화한 루틴(일상) 템플릿 재활성화
--    스페셜(event·special)은 제외 — 일상 루틴 템플릿만 복원.
--    표시-dedup 이 중복을 알아서 합치므로 활성 중복이 있어도 화면엔 1개로 보임.
UPDATE public.missions
SET is_active = true
WHERE is_active = false
  AND repeat_type <> 'event'
  AND difficulty <> 'special';
