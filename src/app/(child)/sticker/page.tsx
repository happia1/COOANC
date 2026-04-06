/**
 * 예전 독바의 스티커 탭 URL 호환용 — 뱃지·곰돌이 스티커는 홈에서 엽니다.
 */
import { redirect } from 'next/navigation'

export default function StickerPage() {
  redirect('/home')
}
