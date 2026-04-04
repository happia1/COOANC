-- ============================================================
-- 018_fix_profiles_rls_and_handle_new_user.sql
-- "Database error creating new user" 대응:
--   1) profiles_self FOR ALL 정책이 INSERT 시 WITH CHECK 에서 auth.uid() 가 NULL 이면
--      트리거(handle_new_user) 삽입을 막을 수 있음 → SELECT/UPDATE/DELETE/INSERT 분리
--   2) handle_new_user: role/name 정규화 + definer 가 postgres 로 동작하도록 OWNER 정렬
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_name text;
  r text;
BEGIN
  r := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));
  IF r = 'child' THEN
    v_role := 'child';
  ELSE
    v_role := 'parent';
  END IF;

  v_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), '사용자');

  INSERT INTO public.profiles (id, role, name)
  VALUES (NEW.id, v_role, v_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- RLS: FOR ALL 제거 후 세분화 (트리거는 테이블 소유자 맥락에서 RLS 우회, 클라이언트는 INSERT 정책 사용)
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
