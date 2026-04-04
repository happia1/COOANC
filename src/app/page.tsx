import { redirect } from 'next/navigation'

/**
 * 루트(/) 접근 시 아이 앱 홈으로 리다이렉트
 */
export default function RootPage() {
  redirect('/home')
}
