import assert from 'node:assert/strict'
import test from 'node:test'
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'
import { getUserForNavigation, shouldClearAuthCookiesAfterError } from '../src/lib/supabase/authSessionErrors.ts'
import { readAutoLoginEnabled, writeAutoLoginEnabled, readRememberedLoginId, writeRememberedLoginId } from '../src/lib/autoLoginPreference.ts'

test('temporary auth failure retries without treating the user as logged out', async () => {
  const user = { id: 'verified-user' }
  let calls = 0
  const auth = { getUser: async () => ++calls === 1
    ? { data: { user: null }, error: new AuthRetryableFetchError('temporary outage', 500) }
    : { data: { user }, error: null } }
  assert.equal(await getUserForNavigation(auth), user)
  assert.equal(calls, 2)
})

test('persistent outage throws; a missing or revoked session returns null', async () => {
  const outage = new AuthRetryableFetchError('temporary outage', 500)
  await assert.rejects(getUserForNavigation({ getUser: async () => ({ data: { user: null }, error: outage }) }), e => e === outage)
  for (const error of [new AuthSessionMissingError(), new AuthApiError('revoked', 401)]) {
    assert.equal(await getUserForNavigation({ getUser: async () => ({ data: { user: null }, error }) }), null)
  }
})

test('a concurrent refresh failure does not request logout', async () => {
  const error = new AuthApiError('Invalid Refresh Token: Already Used', 400, 'refresh_token_already_used')
  assert.equal(shouldClearAuthCookiesAfterError(error), false)
  await assert.rejects(getUserForNavigation({ getUser: async () => ({ data: { user: null }, error }) }), e => e === error)
})

test('ID is remembered independently of auto login, and unchecked ID is removed', () => {
  const values = new Map()
  globalThis.window = { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } }
  try {
    assert.equal(readRememberedLoginId(), '')
    writeRememberedLoginId('  parent@example.com  ', true)
    writeAutoLoginEnabled(false)
    assert.equal(readRememberedLoginId(), 'parent@example.com')
    assert.equal(readAutoLoginEnabled(), false)
    writeRememberedLoginId('', false)
    assert.equal(readRememberedLoginId(), '')
    window.localStorage.getItem = () => { throw new Error('storage blocked') }
    window.localStorage.setItem = () => { throw new Error('storage blocked') }
    window.localStorage.removeItem = () => { throw new Error('storage blocked') }
    assert.equal(readRememberedLoginId(), '')
    assert.equal(readAutoLoginEnabled(), true)
    assert.doesNotThrow(() => writeRememberedLoginId('parent@example.com', true))
    assert.doesNotThrow(() => writeAutoLoginEnabled(true))
  } finally { delete globalThis.window }
})
