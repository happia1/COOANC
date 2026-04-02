/**
 * 홈 페이지: Supabase `children`(자녀) 테이블과의 연동 여부를 확인합니다.
 * - 서버에서만 실행되며, PostgREST를 통해 최대 10행까지 조회합니다.
 */
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()

  // COOANC 도메인: 자녀 정보가 담긴 테이블
  const { data: children, error } = await supabase.from('children').select('*').limit(10)

  if (error) {
    return (
      <div className="p-8">
        <p>에러 발생: {error.message}</p>
      </div>
    )
  }

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">COOANC 데이터 연동 테스트</h1>

      <div className="rounded bg-gray-100 p-4">
        <h2 className="mb-2 font-semibold">자녀 목록 (children 테이블)</h2>
        <pre>{JSON.stringify(children, null, 2)}</pre>
      </div>

      {(children ?? []).length === 0 && (
        <p className="mt-4 text-orange-500">
          ⚠️ 테이블은 연결되었으나 데이터가 없습니다. SQL Editor에서 데이터를 다시 삽입해 보세요.
        </p>
      )}
    </main>
  )
}
