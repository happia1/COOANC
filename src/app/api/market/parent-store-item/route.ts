import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

/**
 * POST /api/market/parent-store-item
 * - JSON: { childId, name, creditPrice, itemType? } (이미지 없을 때)
 * - multipart/form-data: 위 필드 + 선택 필드 `image` (파일)
 * 부모가 연결된 자녀 마켓 전용 상품을 추가합니다. 이미지는 Storage `store_item_images` 에 올린 뒤 public URL 을 DB 에 넣습니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 추가할 수 있어요' }, { status: 403 })
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

  const { data: link, error: linkErr } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (linkErr || !link) {
    return NextResponse.json({ error: '연결된 자녀에게만 상품을 추가할 수 있어요' }, { status: 403 })
  }

  /** 마켓에 올리는 상품은 모두 실물·체험류로 통일(real) */
  const itemType: 'digital' | 'real' = 'real'

  let imageUrl: string | null = null
  if (imageFile) {
    if (!ALLOWED_TYPES.has(imageFile.type.toLowerCase())) {
      return NextResponse.json({ error: 'JPG, PNG, WebP, GIF 이미지만 올릴 수 있어요' }, { status: 400 })
    }
    if (imageFile.size > MAX_BYTES) {
      return NextResponse.json({ error: '이미지는 5MB 이하로 올려 주세요' }, { status: 400 })
    }
    const buf = Buffer.from(await imageFile.arrayBuffer())
    const ext = extForMime(imageFile.type)
    const path = `${user.id}/${randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: imageFile.type,
      upsert: false,
    })
    if (upErr) {
      console.error('[parent-store-item] storage', upErr.message)
      return NextResponse.json({ error: '이미지 업로드에 실패했어요. 잠시 후 다시 시도해 주세요' }, { status: 500 })
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    imageUrl = pub.publicUrl
  }

  const { data: inserted, error: insErr } = await supabase
    .from('store_items')
    .insert({
      family_link_id: link.id,
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
