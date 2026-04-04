import { redirect } from 'next/navigation'

/** /parent → /parent/home 으로 리다이렉트 */
export default function ParentRootPage() {
  redirect('/parent/home')
}
