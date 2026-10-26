/** Public bundles must never contain a server/admin credential. Do not include values in errors. */
export function assertPublicSupabaseKey(value) {
  if (typeof value !== 'string') throw new Error('Supabase 공개용 키가 필요합니다')
  const key=value.trim()
  if (key.startsWith('sb_publishable_')) return
  try {
    const segment=key.split('.')[1]?.replaceAll('-','+').replaceAll('_','/')
    if (segment && JSON.parse(atob(segment)).role === 'anon') return
  } catch { /* reject unknown credentials */ }
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY에는 publishable 또는 anon 키만 사용할 수 있습니다. 관리자 키를 제거하세요.')
}
