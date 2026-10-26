import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertPublicSupabaseKey } from '../src/lib/supabase/publicKeySafety.mjs'
const fixture=role=>`test.${Buffer.from(JSON.stringify({role})).toString('base64url')}.fixture`
test('accepts publishable/anon keys and rejects server keys without echoing them',()=>{
 assert.doesNotThrow(()=>assertPublicSupabaseKey('sb_publishable_test_fixture'))
 assert.doesNotThrow(()=>assertPublicSupabaseKey(fixture('anon')))
 for(const value of [fixture('service_role'),'sb_secret_private_fixture',fixture('authenticated')]) {
  assert.throws(()=>assertPublicSupabaseKey(value),error=>!error.message.includes(value))
 }
})
