import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

const BUCKET = 'store_item_images'
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 5 * 1024 * 1024

function extForMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  if (m === 'image/png') return 'png'
  if (m === 'image/webp') return 'webp'
  if (m === 'image/gif') return 'gif'
  return 'jpg'
}

async function resolveParentAuth(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, response: NextResponse.json({ error: '인증이 필요해요' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return { ok: false as const, response: NextResponse.json({ error: '부모 계정만 사용할 수 있어요' }, { status: 403 }) }
  }
  return { ok: true as const, userId: user.id }
}

async function resolveFamilyLinkIdForChild(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  childId: string,
) {
  const { data: link, error } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', parentId)
    .eq('child_id', childId)
    .maybeSingle()
  if (error || !link) return null
  return link.id
}

/**
 * 이미지 업로드 결과를 단일 형태로 반환합니다.
 * - `response` 가 있으면 실패(그대로 API 응답으로 돌려보냄), 없으면 성공.
 * - 비개발자 메모: tsconfig의 strict가 꺼져 있어 `{ok:true} | {ok:false}` 같은
 *   판별 유니온 타입 좁히기가 동작하지 않으므로, 단순 truthy 체크가 가능한 형태로 둡니다.
 */
async function uploadStoreItemImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  imageFile: File,
): Promise<{ response: NextResponse | null; publicUrl: string | null }> {
  if (!ALLOWED_TYPES.has(imageFile.type.toLowerCase())) {
    return {
      response: NextResponse.json({ error: 'JPG, PNG, WebP, GIF 이미지만 올릴 수 있어요' }, { status: 400 }),
      publicUrl: null,
    }
  }
  if (imageFile.size > MAX_BYTES) {
    return {
      response: NextResponse.json({ error: '이미지는 5MB 이하로 올려 주세요' }, { status: 400 }),
      publicUrl: null,
    }
  }
  const buf = Buffer.from(await imageFile.arrayBuffer())
  const ext = extForMime(imageFile.type)
  const path = `${parentId}/${randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: imageFile.type,
    upsert: false,
  })
  if (upErr) {
    console.error('[parent-store-item] storage', upErr.message)
    return {
      response: NextResponse.json(
        { error: '이미지 업로드에 실패했어요. 잠시 후 다시 시도해 주세요' },
        { status: 500 },
      ),
      publicUrl: null,
    }
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { response: null, publicUrl: pub.publicUrl }
}

/**
 * POST /api/market/parent-store-item
 * - JSON: { childId, name, creditPrice, itemType? } (이미지 없을 때)
 * - multipart/form-data: 위 필드 + 선택 필드 `image` (파일)
 * 부모가 연결된 자녀 마켓 전용 상품을 추가합니다. 이미지는 Storage `store_item_images` 에 올린 뒤 public URL 을 DB 에 넣습니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const auth = await resolveParentAuth(supabase)
  if (!auth.ok) {
    return auth.response
  }

  const ct = req.headers.get('content-type') ?? ''
  /** digital(캐릭터 꾸미기) 는 마켓 추가 대상에서 제외 — 홈 탭에서 구매 */
  const ALLOWED_CATEGORY = new Set(['food', 'toy', 'activity', 'experience'])

  let childId: string
  let name: string
  let creditPrice: number
  let category: string = 'food'
  let imageFile: File | null = null

  try {
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData()
      childId = String(form.get('childId') ?? '').trim()
      name = String(form.get('name') ?? '').trim()
      creditPrice = Number(form.get('creditPrice'))
      const cat = String(form.get('category') ?? 'food')
      if (ALLOWED_CATEGORY.has(cat)) category = cat
      const img = form.get('image')
      if (img instanceof File && img.size > 0) {
        imageFile = img
      }
    } else {
      const body = await req.json()
      childId = typeof body.childId === 'string' ? body.childId.trim() : ''
      name = typeof body.name === 'string' ? body.name.trim() : ''
      creditPrice = Number(body.creditPrice)
      const cat = typeof body.category === 'string' ? body.category : 'food'
      if (ALLOWED_CATEGORY.has(cat)) category = cat
    }
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId || !name || name.length > 80) {
    return NextResponse.json({ error: '상품 이름을 확인해 주세요' }, { status: 400 })
  }

  if (!Number.isFinite(creditPrice) || creditPrice < 0 || creditPrice > 999_999) {
    return NextResponse.json({ error: '크레딧 가격은 0 이상으로 입력해 주세요' }, { status: 400 })
  }

  const linkId = await resolveFamilyLinkIdForChild(supabase, auth.userId, childId)
  if (!linkId) {
    return NextResponse.json({ error: '연결된 자녀에게만 상품을 추가할 수 있어요' }, { status: 403 })
  }

  /** 마켓에 올리는 상품은 모두 실물·체험류로 통일(real) */
  const itemType: 'digital' | 'real' = 'real'
  // 부모·자녀 연결을 검증한 뒤 저장하므로, RLS 누락으로 가족 전용 상품 추가가 막히지 않게 한다.
  const db = createServiceRoleClient() ?? supabase

  let imageUrl: string | null = null
  if (imageFile) {
    const upload = await uploadStoreItemImage(db, auth.userId, imageFile)
    if (upload.response) return upload.response
    imageUrl = upload.publicUrl
  }

  const { data: inserted, error: insErr } = await db
    .from('store_items')
    .insert({
      family_link_id: linkId,
      name,
      description: null,
      image_url: imageUrl,
      credit_price: Math.floor(creditPrice),
      item_type: itemType,
      category,
      level_required: 0,
      is_active: true,
      stock: null,
    })
    .select('*')
    .single()

  if (insErr || !inserted) {
    console.error('[parent-store-item]', insErr?.message)
    return NextResponse.json({ error: '상품을 추가하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ item: inserted })
}

/**
 * PATCH /api/market/parent-store-item
 * - 가족 전용 상품만 수정합니다.
 * - multipart/form-data: { childId, storeItemId, name?, image?, removeImage? }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const auth = await resolveParentAuth(supabase)
  if (!auth.ok) return auth.response

  const ct = req.headers.get('content-type') ?? ''
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json({ error: '폼 데이터 요청만 지원해요' }, { status: 400 })
  }

  const form = await req.formData()
  const childId = String(form.get('childId') ?? '').trim()
  const storeItemId = String(form.get('storeItemId') ?? '').trim()
  const nameRaw = String(form.get('name') ?? '').trim()
  const removeImage = String(form.get('removeImage') ?? '').toLowerCase() === 'true'
  const image = form.get('image')
  const imageFile = image instanceof File && image.size > 0 ? image : null

  if (!childId || !storeItemId) {
    return NextResponse.json({ error: '자녀·상품 정보가 필요해요' }, { status: 400 })
  }
  if (!nameRaw || nameRaw.length > 80) {
    return NextResponse.json({ error: '상품 이름을 확인해 주세요' }, { status: 400 })
  }

  const linkId = await resolveFamilyLinkIdForChild(supabase, auth.userId, childId)
  if (!linkId) {
    return NextResponse.json({ error: '연결된 자녀만 수정할 수 있어요' }, { status: 403 })
  }

  const { data: item, error: itemErr } = await supabase
    .from('store_items')
    .select('*')
    .eq('id', storeItemId)
    .maybeSingle()

  if (itemErr || !item) {
    return NextResponse.json({ error: '상품을 찾을 수 없어요' }, { status: 404 })
  }
  if (item.family_link_id !== linkId) {
    return NextResponse.json({ error: '가족 전용 상품만 수정할 수 있어요' }, { status: 403 })
  }

  let nextImageUrl = item.image_url
  if (removeImage) {
    nextImageUrl = null
  }
  if (imageFile) {
    const upload = await uploadStoreItemImage(supabase, auth.userId, imageFile)
    if (upload.response) return upload.response
    nextImageUrl = upload.publicUrl
  }

  const { data: updated, error: upErr } = await supabase
    .from('store_items')
    .update({
      name: nameRaw,
      image_url: nextImageUrl,
    })
    .eq('id', storeItemId)
    .select('*')
    .single()

  if (upErr || !updated) {
    console.error('[parent-store-item:patch]', upErr?.message)
    return NextResponse.json({ error: '상품 정보를 저장하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ item: updated })
}

/**
 * DELETE /api/market/parent-store-item
 * body: { childId, storeItemId }
 * - 가족 전용 상품만 삭제합니다.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const auth = await resolveParentAuth(supabase)
  if (!auth.ok) return auth.response

  let childId = ''
  let storeItemId = ''
  try {
    const body = await req.json()
    childId = typeof body.childId === 'string' ? body.childId.trim() : ''
    storeItemId = typeof body.storeItemId === 'string' ? body.storeItemId.trim() : ''
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId || !storeItemId) {
    return NextResponse.json({ error: '자녀·상품 정보가 필요해요' }, { status: 400 })
  }

  const linkId = await resolveFamilyLinkIdForChild(supabase, auth.userId, childId)
  if (!linkId) {
    return NextResponse.json({ error: '연결된 자녀만 삭제할 수 있어요' }, { status: 403 })
  }

  const { data: item, error: itemErr } = await supabase
    .from('store_items')
    .select('id, family_link_id')
    .eq('id', storeItemId)
    .maybeSingle()
  if (itemErr || !item) {
    return NextResponse.json({ error: '상품을 찾을 수 없어요' }, { status: 404 })
  }
  if (item.family_link_id !== linkId) {
    return NextResponse.json({ error: '가족 전용 상품만 삭제할 수 있어요' }, { status: 403 })
  }

  const { error: delErr } = await supabase.from('store_items').delete().eq('id', storeItemId)
  if (delErr) {
    console.error('[parent-store-item:delete]', delErr.message)
    return NextResponse.json({ error: '상품을 삭제하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storeItemId })
}
