// Explicit live check: COOANC_LIVE_TEST=1 node tests/market-live-check.mjs
// Uses a disposable child account; finally deletes only that account and its cascading data.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { registerHooks } from 'node:module'
import { createClient } from '@supabase/supabase-js'

assert.equal(process.env.COOANC_LIVE_TEST, '1', 'Live check must be explicitly enabled')
process.loadEnvFile('.env.local')
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/fireGameTrigger.ts') && specifier === './triggerItemMap') specifier += '.ts'
  return next(specifier, context)
} })
const { fireGameTrigger } = await import('../src/lib/gameLayer/fireGameTrigger.ts')
const base = 'http://localhost:3100'
const email = `cooanc-check-${randomUUID()}@example.com`
const password = randomUUID() + 'aA1!'
let childId
let cookie = ''
const checked = async query => {
  const { data, error } = await query
  assert.ifError(error)
  return data
}
async function purchase(item, quantity = 1) {
  const response = await fetch(`${base}/api/market/request`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ itemId: item.id, childId, quantity }),
  })
  return { status: response.status, body: await response.json() }
}
try {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { role: 'child', name: '임시 구매 검증' },
  })
  assert.ifError(error)
  childId = data.user.id
  const items = await checked(admin.from('store_items').select('*').eq('is_active', true).is('family_link_id', null))
  const content = items.find(item => item.category === 'content' && item.credit_price > 0)
  const food = items.find(item => item.category === 'food' && item.credit_price > 0)
  const other = items.find(item => item.category !== 'digital' && item.id !== content?.id && item.id !== food?.id && item.credit_price > 0)
  assert.ok(content && food && other, 'Need three public market items')
  const startingCredits = content.credit_price * 2 + food.credit_price + 100
  await checked(admin.from('child_stats').upsert({ child_id: childId, credits: startingCredits, current_level: Math.max(content.level_required, food.level_required, other.level_required) }, { onConflict: 'child_id' }))
  const signIn = await fetch(`${base}/api/auth/sign-in`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })
  assert.equal(signIn.status, 200, JSON.stringify(await signIn.clone().json()))
  cookie = signIn.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  assert.ok(cookie)
  const first = await purchase(content, 2)
  assert.equal(first.status, 201, JSON.stringify(first.body))
  assert.equal(first.body.request.quantity, 2)
  assert.equal(first.body.request.item_price, content.credit_price * 2)
  assert.equal(first.body.credits, startingCredits - content.credit_price * 2)
  const duplicate = await purchase(content, 2)
  assert.equal(duplicate.status, 409)
  const second = await purchase(food)
  assert.equal(second.status, 201, JSON.stringify(second.body))
  assert.equal(second.body.credits, 100)
  const stats = await checked(admin.from('child_stats').select('credits').eq('child_id', childId).single())
  assert.equal(stats.credits, 100)
  await checked(admin.from('child_stats').update({ credits: 0 }).eq('child_id', childId))
  const insufficient = await purchase(other)
  assert.equal(insufficient.status, 400)
  assert.equal(insufficient.body.code, 'insufficient_credits')
  const requests = await checked(admin.from('purchase_requests').select('id').eq('child_id', childId))
  assert.equal(requests.length, 2)
  const triggerRows = await checked(admin.from('child_trigger_fired').select('trigger_key').eq('child_id', childId))
  assert.equal(triggerRows.filter(row => row.trigger_key === 'FIRST_PURCHASE').length, 1)
  const results = await Promise.all(Array.from({ length: 5 }, () => fireGameTrigger(admin, childId, 'FIRST_SAVE')))
  assert.equal(results.filter(result => result.fired).length, 1)
  assert.equal((await fireGameTrigger(admin, childId, 'FIRST_SAVE')).fired, false)
  for (const day of ['2026-10-25', '2026-10-26']) {
    const rows = await Promise.all(Array.from({ length: 3 }, () => checked(admin.from('child_trigger_fired')
      .upsert({ child_id: childId, trigger_key: `DAILY_NORMAL_STICKER:${day}` }, { onConflict: 'child_id,trigger_key', ignoreDuplicates: true })
      .select('child_id'))))
    assert.equal(rows.flat().length, 1)
  }
  console.log('PASS: real sign-in, quantity purchase, duplicate rejection, second purchase, balance deduction, insufficient funds, single game event, concurrent/day-specific event deduplication')
} finally {
  if (childId) {
    const { error } = await admin.auth.admin.deleteUser(childId)
    assert.ifError(error)
    for (const table of ['profiles', 'child_stats', 'purchase_requests', 'child_trigger_fired']) {
      const remaining = await checked(admin.from(table).select(table === 'child_trigger_fired' ? 'child_id' : 'id').eq(table === 'profiles' ? 'id' : 'child_id', childId))
      assert.equal(remaining.length, 0, `leftover data in ${table}`)
    }
    console.log('PASS: disposable account and cascading test data removed')
  }
}
