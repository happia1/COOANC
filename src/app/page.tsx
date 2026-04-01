/**
 * 메인 페이지(홈)입니다.
 * - 서버에서 Supabase 클라이언트를 만들고, Auth API에 가벼운 요청을 보내 연결을 검증합니다.
 * - 로그인하지 않았다면 session 은 null 이어도 정상입니다. 중요한 것은 error 가 없는지입니다.
 */
import { createClient } from '../lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()

  // DB 테이블 없이도 동작하는 호출: 프로젝트 URL·anon 키가 맞으면 error 없이 응답합니다.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

  // JWT 기준으로 사용자 정보를 한 번 더 확인(세션과 비슷하지만 서버 검증에 가깝습니다).
  const { data: userData, error: userError } = await supabase.auth.getUser()

  const connectionOk = !sessionError && !userError

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">COO-ANC · Supabase 연결 테스트</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-slate-600">연결 상태</h2>
        {connectionOk ? (
          <p className="text-green-700">Supabase 클라이언트 초기화 및 API 호출에 성공했습니다.</p>
        ) : (
          <div className="text-red-700">
            <p className="font-medium">호출 중 오류가 있습니다.</p>
            {sessionError && (
              <pre className="mt-2 overflow-x-auto text-xs">{sessionError.message}</pre>
            )}
            {userError && (
              <pre className="mt-2 overflow-x-auto text-xs">{userError.message}</pre>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-600">불러온 데이터 요약</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-800">
          <li>
            getSession — 로그인 세션:{' '}
            <span className="font-mono">{sessionData.session ? '있음' : '없음 (비로그인도 정상)'}</span>
          </li>
          <li>
            getUser — 현재 사용자:{' '}
            <span className="font-mono">
              {userData.user ? userData.user.email ?? userData.user.id : '없음'}
            </span>
          </li>
        </ul>
      </section>
    </main>
  )
}
