-- ============================================================
-- 020_profiles_parent_read_child_idempotent.sql
-- 019 와 동일 정책을 idempotent 하게 다시 적용합니다.
-- (대시보드에서 019를 실행하지 않은 프로젝트에서 부모가 자녀 profiles 를 못 읽어
--  상세 화면이 곧바로 /parent 로 돌아가던 문제를 해결합니다.)
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_parent_linked_child" ON public.profiles;

CREATE POLICY "profiles_select_parent_linked_child"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_links fl
      WHERE fl.parent_id = auth.uid()
        AND fl.child_id = profiles.id
    )
  );
