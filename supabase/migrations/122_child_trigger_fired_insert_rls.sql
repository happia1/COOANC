-- ============================================================
-- 122_child_trigger_fired_insert_rls.sql
-- 게임 트리거 기록 INSERT 허용
--
-- 문제: child_trigger_fired 에 SELECT 정책만 있어(053), 세션 클라이언트로
--   INSERT 하는 fireGameTrigger 가 42501(row-level security) 로 항상 실패.
--   → 첫 미션/첫 구매 아이템 해제 연출이 동작하지 않음.
--
-- 해결: 자녀 본인 + 연결된 부모(자녀 화면 미리보기 시 부모 세션으로 대행)의
--   INSERT 를 허용. 행 내용은 (child_id, trigger_key) 게이트뿐이라 위험 없음.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'child_trigger_fired'
      AND policyname = 'child_trigger_fired_member_insert'
  ) THEN
    CREATE POLICY child_trigger_fired_member_insert
      ON child_trigger_fired FOR INSERT
      WITH CHECK (
        auth.uid() = child_id
        OR EXISTS (
          SELECT 1 FROM family_links
          WHERE family_links.child_id  = child_trigger_fired.child_id
            AND family_links.parent_id = auth.uid()
        )
      );
  END IF;
END;
$$;
