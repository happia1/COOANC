import assert from 'node:assert/strict'
import test from 'node:test'
import { runSerializedBrowserAuthOp } from '../src/lib/supabase/browserAuthQueue.ts'

test('a late automatic login response finishes before manual login can replace its cookie', async () => {
  let releaseAutoLogin
  let cookie = 'expired-session'
  const events = []
  const response = new Promise(resolve => { releaseAutoLogin = resolve })
  const autoLogin = runSerializedBrowserAuthOp(async () => {
    events.push('auto-start')
    await response
    cookie = 'old-account-refreshed'
    events.push('auto-cookie')
  })
  // The UI can time out and expose manual login while the automatic request is still pending.
  await Promise.resolve()
  const manualLogin = runSerializedBrowserAuthOp(async () => {
    events.push('manual-start')
    cookie = 'new-account'
  })
  await Promise.resolve()
  assert.deepEqual(events, ['auto-start'])
  assert.equal(cookie, 'expired-session')
  releaseAutoLogin()
  await Promise.all([autoLogin, manualLogin])
  assert.deepEqual(events, ['auto-start', 'auto-cookie', 'manual-start'])
  assert.equal(cookie, 'new-account')
})

test('a failed automatic check does not block a queued manual login', async () => {
  const failure = new Error('temporary auth outage')
  const autoLogin = runSerializedBrowserAuthOp(async () => { throw failure })
  const manualLogin = runSerializedBrowserAuthOp(async () => 'manual-login-ok')
  await assert.rejects(autoLogin, error => error === failure)
  assert.equal(await manualLogin, 'manual-login-ok')
})

test('manual login can cancel a stalled check and waits until it has stopped', async () => {
  const controller = new AbortController()
  const events = []
  const autoLogin = runSerializedBrowserAuthOp(() => new Promise((resolve, reject) => {
    controller.signal.addEventListener('abort', () => {
      events.push('auto-stopped')
      reject(controller.signal.reason)
    }, { once: true })
  }))
  await Promise.resolve()
  controller.abort()
  const manualLogin = runSerializedBrowserAuthOp(async () => { events.push('manual-start') })
  await assert.rejects(autoLogin, error => error.name === 'AbortError')
  await manualLogin
  assert.deepEqual(events, ['auto-stopped', 'manual-start'])
})
