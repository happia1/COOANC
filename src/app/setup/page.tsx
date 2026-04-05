import { redirect } from 'next/navigation'

/** 예전 주소(/setup)로 들어오면 홈 라우터로 보냅니다. */
export default function SetupLegacyRedirect() {
  redirect('/')
}
