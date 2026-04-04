-- ============================================================
-- 010_purchase_requests.sql
-- 구매 요청 테이블 + 승인 시 크레딧 자동 차감 트리거
-- (보안 핵심: 크레딧 차감은 트리거로만 처리)
-- ============================================================

create table if not exists purchase_requests (
  id              uuid primary key default uuid_generate_v4(),
  child_id        uuid not null references profiles(id) on delete cascade,
  item_id         uuid references store_items(id),
  item_name       text not null,        -- 상품명 스냅샷 (상품 삭제 후에도 이력 보존)
  item_price      int not null,         -- 가격 스냅샷
  item_type       text not null,        -- 상품 유형 스냅샷
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'delivered')),
  child_message   text,                 -- 아이의 구매 메시지
  parent_note     text,                 -- 부모의 반려 사유 또는 메모
  requested_at    timestamptz default now(),
  approved_at     timestamptz,
  delivered_at    timestamptz
);

-- ============================================================
-- 구매 승인 시 크레딧 자동 차감 트리거
-- ============================================================
create or replace function on_purchase_approved()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'approved' and old.status = 'pending' then

    -- 크레딧 잔액 검증
    if (select credits from child_stats where child_id = new.child_id) < new.item_price then
      raise exception '크레딧이 부족합니다.';
    end if;

    -- 크레딧 차감
    update child_stats set
      credits    = credits - new.item_price,
      updated_at = now()
    where child_id = new.child_id;

    new.approved_at := now();
  end if;

  return new;
end;
$$;

create trigger purchase_approved_trigger
  before update on purchase_requests
  for each row execute procedure on_purchase_approved();
