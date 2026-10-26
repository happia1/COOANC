import assert from 'node:assert/strict'
import { test } from 'node:test'
import { queueChildAction, childActionSequence, fetchReceiptedAction } from '../src/lib/childActionQueue.ts'

test('reserves piggy input before its batch is sent, then purchase uses the confirmed balance', async () => {
  const child = crypto.randomUUID()
  let credits = 100
  let release
  const ready = new Promise(resolve => { release = resolve })
  const mission = queueChildAction(child, async () => { credits += 20 })
  const piggy = queueChildAction(child, async () => { await ready; credits -= 50 })
  const sequence = childActionSequence(child)
  const purchase = queueChildAction(child, async () => { assert.equal(credits,70); credits -= 30 })
  assert.notEqual(sequence,childActionSequence(child), 'must not merge a new tap across purchase')
  release()
  await Promise.all([mission,piggy,purchase])
  assert.equal(credits,40)
})
test('unknown failed action prevents a dependent purchase; another child remains usable', async () => {
  const child = crypto.randomUUID()
  await assert.rejects(queueChildAction(child, async () => { throw new Error('unknown commit') }))
  let ran = false
  await assert.rejects(queueChildAction(child, async () => { ran = true }))
  assert.equal(ran,false)
  assert.equal(await queueChildAction(crypto.randomUUID(), async () => 42),42)
})
test('lost response retries with the same receipt ID', async () => {
  const original = global.fetch
  const bodies = []
  global.fetch = async (_, options) => {
    bodies.push(JSON.parse(options.body))
    if (bodies.length === 1) throw new Error('response lost')
    return new Response('{}', { status: 200 })
  }
  try {
    const requestId = crypto.randomUUID()
    assert.equal((await fetchReceiptedAction('/test',{ requestId })).status,200)
    assert.deepEqual(bodies,[{ requestId },{ requestId }])
  } finally { global.fetch = original }
})
