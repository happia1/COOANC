import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeUuidParam } from '@/lib/normalizeUuid'

type PageProps = { params: Promise<{ childId: string }> }

/**
 * 부모가 자녀 카드를 눌렀을 때 보는 상세 화면입니다.
 * - family_links 로 연결된 자녀만 조회 가능합니다(RLS + 서버에서 한 번 더 검증).
 */
export default async function ParentChildDetailPage({ params }: PageProps) {
  const { childId: rawId } = await params
  const childId = normalizeUuidParam(rawId)

  // UUID가 아니면 부모 홈으로 (404 대신 — 사용자가 주소를 잘못 쓴 경우)
  if (!childId) {
    redirect('/parent')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 부모 계정만 이 페이지를 볼 수 있음
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'parent') redirect('/home')

  // family_links 에 연결이 없으면 다른 사람 자녀를 볼 수 없음 → 부모 홈으로
  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (!link) {
    redirect('/parent')
  }

  const { data: childProfile } = await supabase
    .from('profiles')
    .select('id, name, role, age, created_at')
    .eq('id', childId)
    .maybeSingle()

  // RLS 미적용·데이터 불일치 시에도 404보다 목록으로 돌아가게 함
  if (!childProfile || childProfile.role !== 'child') {
    redirect('/parent')
  }

  const { data: stats } = await supabase
    .from('child_stats')
    .select(
      'credits, hearts, total_credits_earned, current_level, exp, exp_to_next_level, eq_delay_score, eq_routine_rate, eq_save_ratio, streak_days, longest_streak, last_mission_date',
    )
    .eq('child_id', childId)
    .maybeSingle()

  const s = stats ?? null

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50">
      <div className="w-full max-w-md mx-auto px-4 pt-6 pb-12">
        {/* 상단: 부모 홈으로 돌아가기 */}
        <div className="mb-6">
          <Link
            href="/parent"
            className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:underline"
          >
            ← 부모 홈
          </Link>
        </div>

        {/* 자녀 이름·나이·안내 문구 */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-4">
          <div className="flex items-start gap-4">
            <span className="text-5xl" aria-hidden>
              🐣
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">자녀 계정</p>
              <h1 className="text-xl font-black text-brand-text truncate">{childProfile.name}</h1>
              {typeof childProfile.age === 'number' && (
                <p className="text-sm text-gray-500 mt-1">{childProfile.age}세</p>
              )}
              <p className="text-[11px] text-gray-400 mt-2">
                자녀는 이 계정으로 앱에 로그인해요. PIN은 자녀만 알고 있어요.
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-sm font-bold text-brand-text mb-3 px-1">경제 활동 요약</h2>

        {/* 크레딧·하트·레벨·연속 미션을 한눈에 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl shadow px-4 py-3 text-center">
            <p className="text-2xl font-black text-brand-blue">{s?.credits ?? 0}</p>
            <p className="text-[11px] text-gray-400">크레딧</p>
          </div>
          <div className="bg-white rounded-2xl shadow px-4 py-3 text-center">
            <p className="text-2xl font-black text-rose-500">{s?.hearts ?? 0}</p>
            <p className="text-[11px] text-gray-400">하트</p>
          </div>
          <div className="bg-white rounded-2xl shadow px-4 py-3 text-center">
            <p className="text-2xl font-black text-brand-text">Lv.{s?.current_level ?? 0}</p>
            <p className="text-[11px] text-gray-400">레벨</p>
          </div>
          <div className="bg-white rounded-2xl shadow px-4 py-3 text-center">
            <p className="text-2xl font-black text-amber-500">🔥 {s?.streak_days ?? 0}</p>
            <p className="text-[11px] text-gray-400">연속 미션(일)</p>
          </div>
        </div>

        {/* EXP, 누적 획득, 연속 기록 */}
        <div className="bg-white rounded-3xl shadow-md p-5 mb-4">
          <h3 className="text-xs font-bold text-gray-400 mb-3">경험치 · 성장</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">EXP</span>
              <span className="font-mono font-bold">
                {s?.exp ?? 0} / {s?.exp_to_next_level ?? 100}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">누적 크레딧 획득</span>
              <span className="font-mono font-bold">{s?.total_credits_earned ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">최장 연속</span>
              <span className="font-mono font-bold">{s?.longest_streak ?? 0}일</span>
            </div>
            {s?.last_mission_date && (
              <div className="flex justify-between">
                <span className="text-gray-500">마지막 미션일</span>
                <span className="font-mono text-xs">{s.last_mission_date}</span>
              </div>
            )}
          </div>
        </div>

        {/* EQ: 만족 지연·루틴·저축 비중 (막대로 시각화) */}
        <div className="bg-white rounded-3xl shadow-md p-5">
          <h3 className="text-xs font-bold text-gray-400 mb-3">경제 습관 지표 (EQ)</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">만족 지연</span>
                <span className="font-bold">{s?.eq_delay_score ?? 0}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-blue/80"
                  style={{ width: `${Math.min(100, s?.eq_delay_score ?? 0)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">루틴 완주</span>
                <span className="font-bold">{s?.eq_routine_rate ?? 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500/80"
                  style={{ width: `${Math.min(100, s?.eq_routine_rate ?? 0)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">저축 비중</span>
                <span className="font-bold">{s?.eq_save_ratio ?? 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500/80"
                  style={{ width: `${Math.min(100, s?.eq_save_ratio ?? 0)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
