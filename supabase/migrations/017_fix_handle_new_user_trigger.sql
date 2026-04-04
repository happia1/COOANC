-- ============================================================
-- 017_fix_handle_new_user_trigger.sql
-- handle_new_user 트리거 재작성:
--   - EXCEPTION 핸들러 추가: 프로필 삽입 실패 시에도 auth user 생성은 성공
--   - ON CONFLICT DO NOTHING: 중복 삽입 무시
--   - SET search_path: 명시적 스키마 설정
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'parent'),
    COALESCE(NEW.raw_user_meta_data->>'name', '사용자')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 프로필 삽입 실패해도 auth user 생성은 계속 진행
    RAISE WARNING 'handle_new_user: profile insert failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
