import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('demo completes each card once, finishes, and resets without app services', () => {
  let focused
  const element = name => ({ hidden: false, disabled: false, dataset: { mission: name }, addEventListener(_, fn) { this.click = fn }, focus() { focused = name } })
  const cards = [element('가글하기'), element('머리 빗기')]
  const nodes = Object.fromEntries(['[data-demo-count]', 'progress', '[data-demo-credit]', '[data-demo-heart]', '.demo-status', '.demo-finished', '.demo-reset', '.demo-cards'].map(key => [key, element(key)]))
  const root = { querySelectorAll: () => cards, querySelector: key => nodes[key] }
  runInNewContext(readFileSync(new URL('../public/site/js/mission-demo.js', import.meta.url), 'utf8'), {
    document: { querySelectorAll: () => [root] },
    window: { matchMedia: () => ({ matches: true }) },
  })
  cards[0].click()
  cards[0].click()
  assert.equal(nodes['[data-demo-credit]'].textContent, '10')
  assert.equal(cards[0].hidden, true)
  assert.equal(focused, '머리 빗기')
  cards[1].click()
  assert.equal(nodes.progress.value, 2)
  assert.equal(nodes['[data-demo-credit]'].textContent, '20')
  assert.equal(nodes['[data-demo-heart]'].textContent, '2')
  assert.equal(nodes['.demo-finished'].hidden, false)
  assert.equal(nodes['.demo-cards'].hidden, true)
  assert.equal(focused, '.demo-reset')
  nodes['.demo-reset'].click()
  assert.equal(nodes.progress.value, 0)
  assert.equal(nodes['.demo-finished'].hidden, true)
  assert.ok(cards.every(card => !card.hidden && !card.disabled))
  cards[1].click()
  assert.equal(nodes['[data-demo-credit]'].textContent, '10')
})
