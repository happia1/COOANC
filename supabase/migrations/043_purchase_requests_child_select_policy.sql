-- 자녀 본인 행 SELECT 를 명시적으로 허용 (기존 FOR ALL 정책과 OR 결합)
-- 원격 프로젝트에 이미 수동 적용된 경우 중복 생성을 피합니다.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'purchase_requests'
      AND policyname = 'child can view own requests'
  ) THEN
    CREATE POLICY "child can view own requests"
      ON public.purchase_requests
      FOR SELECT
      TO authenticated
      USING (child_id = auth.uid());
  END IF;
END
$$;
