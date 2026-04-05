import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeUuidParam } from '@/lib/normalizeUuid'
import { resolveDisplayAge } from '@/lib/ageFromBirthDate'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import { selectChildProfileDetailById } from '@/lib/supabase/childProfileSelect'

type PageProps = { params: Promise<{ childId: string }> }

/**
 * 부모가 자녀 카드를 눌렀을 때 보는 상세 화면입니다.
 * - family_links 로 연결된 자녀만 조회 가능합니다(RLS + 서버에서 한 번 더 검증).
 * - 상단 프로필은 부모 홈과 동일한 컴팩트 카드 컴포넌트를 사용합니다.
 */
export default async function ParentChildDetailPage({ params }: PageProps) {
  const { childId: rawId } = await params
  const childId = normalizeUuidParam(rawId)

  if (!childId) {
    redirect('/parent')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'parent') redirect('/home')

  const { data: link } = await supabase
    .from('family_links')
    .select('id, nickname')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (!link) {
    redirect('/parent')
  }

  const { data: childProfile, error: profileErr } = await selectChildProfileDetailById(supabase, childId)
  if (profileErr) {
    console.error('[parent child detail] profile:', profileErr.message)
  }

  if (childProfile && childProfile.role !== 'child') {
    redirect('/parent')
  }

  const displayName =
    childProfile?.role === 'child' && childProfile.name?.trim()
      ? childProfile.name.trim()
      : link.nickname?.trim() || '자녀'

  const displayAge = resolveDisplayAge(childProfile?.birth_date ?? null, childProfile?.age ?? null)

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
        <div className="mb-4">
          <Link
            href="/parent"
            className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:underline"
          >
            ← 부모 홈
          </Link>
        </div>

        <CompactChildProfileCard
          name={displayName}
          age={displayAge}
          avatarUrl={childProfile?.avatar_url ?? null}
          level={s?.current_level ?? 0}
          credits={s?.credits ?? 0}
          hearts={s?.hearts ?? 0}
          streakDays={s?.streak_days ?? 0}
          className="mb-3 shadow-md"
        />

        {!childProfile && (
          <p className="text-[11px] text-gray-400 mb-2 px-0.5">
            이름은 보안 설정에 따라 잠시 표시되지 않을 수 있어요. 아래 통계는 그대로 볼 수 있어요.
          </p>
        )}
        <p className="text-[11px] text-gray-400 mb-4 px-0.5">
          자녀 앱은 이 계정으로 동작해요. 미션·보상은 부모 화면에서도 함께 관리할 수 있어요.
        </p>

        <h2 className="text-xs font-bold text-brand-text mb-2 px-0.5">경제 활동 요약</h2>

        <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/[0.04] px-3 py-2.5 mb-3 text-xs">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 tabular-nums">
            <span className="text-gray-500">
              누적 <strong className="text-brand-text">{s?.total_credits_earned ?? 0}</strong>🪙
            </span>
            <span className="text-gray-500">
              최장 <strong className="text-amber-600">{s?.longest_streak ?? 0}</strong>일
            </span>
            {s?.last_mission_date && (
              <span className="text-gray-400 w-full sm:w-auto">마지막 미션 {s.last_mission_date}</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/[0.04] p-3 mb-3">
          <h3 className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wide">경제 습관 (EQ)</h3>
          <div className="space-y-2 text-xs">
            <EqRow label="만족 지연" value={s?.eq_delay_score ?? 0} barClass="bg-brand-blue/80" />
            <EqRow label="루틴 완주" value={s?.eq_routine_rate ?? 0} barClass="bg-green-500/80" suffix="%" />
            <EqRow label="저축 비중" value={s?.eq_save_ratio ?? 0} barClass="bg-sky-500/80" suffix="%" />
          </div>
        </div>
      </div>
    </div>
  )
}

function EqRow({
  label,
  value,
  barClass,
  suffix = '',
}: {
  label: string
  value: number
  barClass: string
  suffix?: string
}) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span className="font-bold tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  )
}
