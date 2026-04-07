-- 부모가 「상품 구매하기」(외부 쇼핑몰) 경로를 택한 경우: 자녀 화면에서 별도 안내를 보여 주기 위한 상태
alter table purchase_requests
  drop constraint if exists purchase_requests_status_check;

alter table purchase_requests
  add constraint purchase_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'delivered', 'parent_buying'));
