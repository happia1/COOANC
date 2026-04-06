import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PRAISE_ASSET_STICKER_KEYS } from '@/lib/praiseAssetStickers'
import { PRAISE_STICKER_FRAME_KEYS } from '@/lib/shopAnimationsAtlas'
import { PRAISE_UI_SPRITE_KEYS } from '@/lib/praiseStickerUi'

/** 부모가 보낼 수 있는 스티커 키(아틀라스 프레임 + UI 스프라이트 + PNG 에셋) */
const ALLOWED_SPRITE_KEYS = [
  ...PRAISE_STICKER_FRAME_KEYS,
  ...PRAISE_UI_SPRITE_KEYS,
  ...PRAISE_ASSET_STICKER_KEYS,
] as readonly string[]

/**
 * POST /api/praise-sticker/grant
 * 부모가 연결된 자녀에게 칭찬 스티커를 보냅니다.
 * body: { childId: string, spriteKey: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 보낼 수 있어요' }, { status: 403 })
  }

  let childId: string
  let spriteKey: string
  try {
    ;({ childId, spriteKey } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId || typeof spriteKey !== 'string') {
    return NextResponse.json({ error: '자녀와 스티커를 선택해주세요' }, { status: 400 })
  }

  if (!ALLOWED_SPRITE_KEYS.includes(spriteKey)) {
    return NextResponse.json({ error: '지원하지 않는 스티커예요' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '연결된 자녀만 선택할 수 있어요' }, { status: 403 })
  }

  const { data: row, error } = await supabase
    .from('praise_sticker_grants')
    .insert({
      child_id: childId,
      parent_id: user.id,
      sprite_key: spriteKey,
    })
    .select('id')
    .single()

  if (error) {
    // 권한·RLS·마이그레이션 누락 등 구분해 로그에 남기고, 사용자에게는 이해하기 쉬운 문구만 전달합니다.
    console.error('[praise-sticker/grant]', error.code, error.message, error.details)
    const msgLc = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
    let userMessage = '저장에 실패했어요'
    if (error.code === '42501' || msgLc.includes('row-level security')) {
      userMessage = '보낼 권한이 없거나 자녀와의 연결을 확인할 수 없어요'
    } else if (
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      msgLc.includes('does not exist') ||
      msgLc.includes('schema cache') ||
      msgLc.includes('could not find the table')
    ) {
      // PostgREST 는 테이블이 없거나 API 스키마 캐시에 없을 때 PGRST205 를 씁니다(로그로 확인됨).
      userMessage =
        '스티커 저장 테이블이 아직 없어요. Supabase에 마이그레이션 033·035 등을 적용한 뒤 대시보드에서 API 스키마를 새로고침해 주세요'
    } else if (error.code === '23503') {
      userMessage = '선택한 자녀 계정을 찾을 수 없어요'
    }
    return NextResponse.json({ error: userMessage }, { status: 500 })
  }

  return NextResponse.json({ id: row.id })
}
