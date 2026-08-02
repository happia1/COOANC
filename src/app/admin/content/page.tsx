/**
 * 콘텐츠존 기본(전 가족 공통) 채널·카테고리 운영자 관리 화면.
 * `CONTENT_ADMIN_EMAILS` 환경변수에 등록된 이메일로 로그인했을 때만 접근할 수 있습니다.
 */

export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveContentAdminUser } from '@/lib/adminContentAccess'
import AdminContentManagerClient from '@/components/admin/AdminContentManagerClient'
import type { ContentCategory, ContentChannel } from '@/types/database'

export default async function AdminContentPage() {
  const supabase = await createClient()
  const auth = await resolveContentAdminUser(supabase)
  if (auth.ok === false) {
    redirect(auth.reason === 'unauthenticated' ? '/login' : '/home')
  }

  const db = createServiceRoleClient() ?? supabase
  const [categoriesRes, channelsRes] = await Promise.all([
    db.from('content_categories').select('*').order('order_index', { ascending: true }),
    db
      .from('content_channels')
      .select('*')
      .is('family_link_id', null)
      .order('order_index', { ascending: true }),
  ])

  const categories = (categoriesRes.data ?? []) as ContentCategory[]
  const channels = (channelsRes.data ?? []) as ContentChannel[]

  return (
    <div className="min-h-dvh bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-black text-gray-900">콘텐츠존 기본 라인업 관리</h1>
        <p className="mt-1 text-sm font-bold text-gray-500">
          여기서 추가·수정하는 카테고리·채널은 모든 가족의 자녀 화면에 기본으로 노출돼요.
        </p>
        <div className="mt-6">
          <AdminContentManagerClient initialCategories={categories} initialChannels={channels} />
        </div>
      </div>
    </div>
  )
}
