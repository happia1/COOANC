import { redirect } from 'next/navigation'

/**
 * 짧은 주소 `/parent` 로 들어온 경우, 실제 부모 홈 탭 주소로 보냅니다.
 *
 * 비개발자 설명: 즐겨찾기나 링크를 `/parent` 로만 걸어 두어도
 * 자동으로 홈(`/parent/home`)이 열리게 하려는 장치입니다.
 */
export default function ParentRootPage() {
  redirect('/parent/home')
}
