/**
 * 메인 페이지(홈)입니다.
 * - Auth: Supabase Auth API로 키·URL 유효성을 확인합니다.
 * - DB: PostgREST(REST)를 통해 Postgres 테이블을 조회해 실제 DB 경로를 검증합니다.
 * - connection_test 테이블이 없으면 SQL 에디터용 스크립트를 화면에 표시합니다(RLS·최소 권한은 프로덕션 전에 재검토).
 */
import { createClient } from '../lib/supabase/server'

/** 서버 전용: 테이블 이름만 바꿔 테스트할 때 .env.local 에 넣습니다(브라우저에 노출하지 않음). */
const DB_TEST_TABLE = process.env.SUPABASE_DB_TEST_TABLE?.trim() || 'connection_test'

/** 대시보드 SQL Editor에 붙여 넣을 초기 스크립트(anon 읽기 전용 — 운영 전 정책 조정 필요). */
const CONNECTION_TEST_SQL = `-- 연결 테스트용 테이블 + anon SELECT (개발용)
create table if not exists public.connection_test (
  id uuid primary key default gen_random_uuid(),
  message text not null default 'ok',
  created_at timestamptz not null default now()
);

alter table public.connection_test enable row level security;

drop policy if exists "connection_test_anon_select" on public.connection_test;
create policy "connection_test_anon_select"
  on public.connection_test for select
  to anon
  using (true);

insert into public.connection_test (message)
select 'COOANC DB 연결 테스트'
where not exists (select 1 from public.connection_test);
`

export default async function HomePage() {
  const supabase = await createClient()

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const authOk = !sessionError && !userError

  // PostgREST → Postgres: 실제 DB 왕복
  const {
    data: dbRows,
    error: dbError,
    count: dbCount,
  } = await supabase.from(DB_TEST_TABLE).select('*', { count: 'exact' }).limit(10)

  const dbOk = !dbError

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">COO-ANC · Supabase 연결 테스트</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-slate-600">Auth API</h2>
        {authOk ? (
          <p className="text-green-700">Auth 호출 성공 (세션/사용자 조회).</p>
        ) : (
          <div className="text-red-700">
            <p className="font-medium">Auth 오류</p>
            {sessionError && (
              <pre className="mt-2 overflow-x-auto text-xs">{sessionError.message}</pre>
            )}
            {userError && <pre className="mt-2 overflow-x-auto text-xs">{userError.message}</pre>}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-slate-600">
          Postgres (PostgREST) — 테이블 <code className="rounded bg-slate-100 px-1">{DB_TEST_TABLE}</code>
        </h2>
        {dbOk ? (
          <div className="space-y-2 text-green-800">
            <p>
              DB 조회 성공 · 예상 행 수(최대 10행 기준):{' '}
              <span className="font-mono">{dbCount ?? dbRows?.length ?? 0}</span>
            </p>
            <pre className="max-h-48 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-800">
              {JSON.stringify(dbRows ?? [], null, 2)}
            </pre>
          </div>
        ) : (
          <div className="space-y-3 text-red-800">
            <p className="font-medium">DB 조회 실패</p>
            <pre className="overflow-x-auto rounded bg-red-50 p-3 text-xs">{dbError?.message}</pre>
            <p className="text-sm text-slate-600">
              테이블이 없거나 RLS로 막힌 경우입니다. 아래 SQL을 Supabase 대시보드 → SQL Editor에서 실행한 뒤 새로고침하세요.
            </p>
            <pre className="max-h-64 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
              {CONNECTION_TEST_SQL}
            </pre>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-600">Auth 데이터 요약</h2>
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
