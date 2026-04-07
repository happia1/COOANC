import type { PurchaseRequest } from '@/types/database'

/**
 * 구매 요청 상태를 자녀·부모 UI에서 동일한 문구·색으로 보여 줍니다.
 * (마켓 「내 요청 현황」과 부모 「승인 내역」이 같은 기준을 씁니다.)
 */
export function purchaseRequestStatusPill(status: PurchaseRequest['status']): {
  label: string
  /** 회색=대기, 파랑=진행 계열, 빨강=반려, 초록=도착 */
  pillClass: string
} {
  switch (status) {
    case 'pending':
      return {
        label: '부모님 확인 중',
        pillClass: 'bg-gray-200 text-gray-800 ring-1 ring-gray-300',
      }
    case 'parent_buying':
      return {
        label: '부모님이 상품 구매 중',
        pillClass: 'bg-brand-blue text-white ring-1 ring-brand-blue/40',
      }
    case 'approved':
      return {
        label: '승인됨 · 배송 준비',
        pillClass: 'bg-sky-500 text-white ring-1 ring-sky-400/50',
      }
    case 'rejected':
      return {
        label: '반려됨',
        pillClass: 'bg-red-500 text-white ring-1 ring-red-400/60',
      }
    case 'delivered':
      return {
        label: '도착 완료',
        pillClass: 'bg-emerald-500 text-white ring-1 ring-emerald-400/50',
      }
    default:
      return { label: String(status), pillClass: 'bg-gray-200 text-gray-700' }
  }
}
