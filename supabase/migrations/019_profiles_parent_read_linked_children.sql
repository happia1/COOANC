-- ============================================================
-- 019_profiles_parent_read_linked_children.sql
-- 부모가 family_links 로 연결된 자녀의 profiles 행을 SELECT 할 수 있게 함.
-- (기존 profiles_select_own 은 본인 행만 허용 → 부모 홈에서 자녀 카드가 비어 보이던 문제)
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
