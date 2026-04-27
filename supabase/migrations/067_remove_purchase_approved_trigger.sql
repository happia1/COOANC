-- 승인 시 credits 재차감 트리거 제거
-- 크레딧은 구매 요청 생성 시점(/api/market/request 등)에 이미 차감됩니다.

DROP TRIGGER IF EXISTS purchase_approved_trigger ON public.purchase_requests;
DROP FUNCTION IF EXISTS public.on_purchase_approved();
