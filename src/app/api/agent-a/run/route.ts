import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 에이전트 기본 URL 폴백(환경변수 미설정 시 사용) */
const DEFAULT_AGENT_URL = 'https://cooanc-agent.onrender.com'

/** 에이전트 서버 URL을 안전하게 정규화합니다. */
function resolveAgentBaseUrl(): string {
  const raw = (process.env.AGENT_BASE_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? '').trim()
  const base = raw.length > 0 ? raw : DEFAULT_AGENT_URL
  return base.replace(/\/$/, '')
}

/** 부모 홈에서 Agent A 실행을 트리거하는 서버 프록시 API */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      child_id?: string
      parent_id?: string
    }

    const childId = String(body.child_id ?? '').trim()
    if (!childId) {
      return NextResponse.json({ ok: false, error: 'child_id_required' }, { status: 400 })
    }

    // 현재 로그인 세션 토큰을 읽어 에이전트 서버 인증 헤더로 전달합니다.
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token ?? ''
    const parentId = String(body.parent_id ?? session?.user?.id ?? '').trim()

    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 180_000)
    try {
      const res = await fetch(`${resolveAgentBaseUrl()}/agent-a/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ child_id: childId, parent_id: parentId }),
        signal: controller.signal,
        cache: 'no-store',
      })

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      return NextResponse.json(json, { status: res.status })
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'agent_proxy_failed' }, { status: 502 })
  }
}
