-- 선행 조건: 029_child_market_hidden_items.sql 로 public.child_market_hidden_items 테이블이 있어야 합니다.
-- (038만 적용하면 relation does not exist [42P01] 가 납니다.)
--
-- 마켓 메뉴 숨김 토글: authenticated 부모가 테이블에 직접 INSERT·DELETE 권한이 없어도
-- (로컬에 SERVICE_ROLE_KEY 가 없을 때) API 가 실패하지 않도록 SECURITY DEFINER RPC 로 처리합니다.
-- family_links 로 연결된 부모만 호출 가능 — 내부에서 auth.uid() 로 검증합니다.

create or replace function public.set_child_market_item_hidden(
  p_child_id uuid,
  p_store_item_id uuid,
  p_hidden boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '인증이 필요해요';
  end if;

  if not exists (
    select 1
    from public.family_links fl
    where fl.parent_id = auth.uid()
      and fl.child_id = p_child_id
  ) then
    raise exception '연결된 자녀만 설정할 수 있어요';
  end if;

  if p_hidden then
    insert into public.child_market_hidden_items (child_id, store_item_id)
    values (p_child_id, p_store_item_id)
    on conflict (child_id, store_item_id) do nothing;
  else
    delete from public.child_market_hidden_items
    where child_id = p_child_id
      and store_item_id = p_store_item_id;
  end if;
end;
$$;

comment on function public.set_child_market_item_hidden(uuid, uuid, boolean) is
  '부모: 연결된 자녀 마켓 상품 숨김/표시. 가족 연결 검증 후 child_market_hidden_items 변경.';

grant execute on function public.set_child_market_item_hidden(uuid, uuid, boolean) to authenticated;
