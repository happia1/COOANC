-- child_market_hidden_items: PostgREST/RLS 로 부모가 INSERT·DELETE 할 때 테이블 권한이 필요합니다.
-- (SERVICE_ROLE_KEY 가 없는 로컬/API 환경에서 숨김 토글 시 permission denied 가 나던 문제)
-- RLS 정책으로 실제로 쓸 수 있는 행은 여전히 가족 연결된 부모만 제한됩니다.

grant select, insert, delete on table public.child_market_hidden_items to authenticated;
