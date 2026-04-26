/**
 * POST /api/child/rapid-tap-alert
 *
 * 자녀가 3초 이내에 미션 카드를 5개 이상 연속으로 탭했을 때 호출됩니다.
 * - 자녀 세션을 검증한 뒤 `rapid_tap_alerts` 테이블에 기록합니다.
 * - 부모 앱은 이 테이블을 폴링해 알림을 표시합니다.
 *
 * ※ Supabase에 아래 테이블이 없으면 먼저 생성해 주세요:
 *
 * CREATE TABLE rapid_tap_alerts (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   child_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 *   detected_at timestamptz NOT NULL DEFAULT now(),
 *   acknowledged boolean NOT NULL DEFAULT false,
 *   mission_count int NOT NULL DEFAULT 5
 * );
 *
 * -- RLS: 부모가 자신의 자녀 알림만 읽을 수 있도록 합니다.
 * ALTER TABLE rapid_tap_alerts ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "parent_can_read_child_alerts"
 *   ON rapid_tap_alerts FOR SELECT
 *   USING (child_id IN (
 *     SELECT child_id FROM family_links WHERE parent_id = auth.uid()
 *   ));
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { mission_count?: number }
    const missionCount = typeof body.mission_count === 'number' ? body.mission_count : 5

    /** 자녀 세션을 검증합니다 */
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const childId = user.id

    /** service_role 클라이언트로 RLS 없이 삽입합니다 */
    const svc = createServiceRoleClient()
    if (!svc) {
      return NextResponse.json({ error: 'service_role_unavailable' }, { status: 500 })
    }

    const { error: insertError } = await svc
      .from('rapid_tap_alerts')
      .insert({
        child_id: childId,
        detected_at: new Date().toISOString(),
        acknowledged: false,
        mission_count: missionCount,
      })

    if (insertError) {
      console.error('[rapid-tap-alert] insert error:', insertError.message)
      return NextResponse.json({ error: 'insert_failed', detail: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[rapid-tap-alert] unexpected error:', e)
    return NextResponse.json({ error: 'unknown' }, { status: 500 })
  }
}
