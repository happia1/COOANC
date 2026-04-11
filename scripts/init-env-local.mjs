/**
 * `.env.local` 이 없으면 `.env.example` 을 복사해 만듭니다.
 * Supabase URL·anon 키는 대시보드에서 직접 붙여 넣어야 합니다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const example = path.join(root, '.env.example')
const local = path.join(root, '.env.local')

if (fs.existsSync(local)) {
  console.log('[init-env-local] .env.local 은 이미 있습니다. Supabase 두 변수가 비어 있지 않은지 확인하세요.')
  process.exit(0)
}

if (!fs.existsSync(example)) {
  console.error('[init-env-local] .env.example 이 없습니다.')
  process.exit(1)
}

fs.copyFileSync(example, local)
console.log('[init-env-local] .env.local 을 .env.example 에서 만들었습니다.')
console.log('다음: Supabase 대시보드 → Project Settings → API 에서 URL·anon 키를 붙여 넣고 저장하세요.')
