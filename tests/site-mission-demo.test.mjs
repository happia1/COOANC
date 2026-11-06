import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

function element(dataset = {}) {
  const attrs = new Map(), classes = new Set(), events = new Map()
  return {
    dataset, hidden: false, disabled: false, children: [], textContent: '', scrollLeft: 0,
    style: { setProperty() {} }, classList: { add: n => classes.add(n), remove: n => classes.delete(n), toggle: (n, on) => on ? classes.add(n) : classes.delete(n) },
    addEventListener: (name, fn) => events.set(name, fn), click() { events.get('click')?.() },
    setAttribute: (k, v) => attrs.set(k, v), getAttribute: k => attrs.get(k),
    append(...children) { this.children.push(...children) }, replaceChildren() { this.children = [] },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    focus() {}, dispatchEvent() {}, scrollIntoView() {}, remove() {},
  }
}
const source = name => readFileSync(new URL(`../public/site/js/${name}.js`, import.meta.url), 'utf8')

for (const reduced of [false, true]) test(`five missions, duplicate taps and replay; reduced motion ${reduced}`, () => {
  const timers = [], cards = Array.from({ length: 5 }, (_, i) => element({ mission: `미션 ${i}` }))
  const keys = ['.demo-cards','[data-demo-count]','progress','[data-demo-credit]','[data-demo-heart]','.demo-status','.demo-finished','.demo-reset','.demo-rail-controls','.demo-sparkles']
  const nodes = Object.fromEntries(keys.map(k => [k, element()]))
  const root = { querySelectorAll: () => cards, querySelector: k => nodes[k] }
  runInNewContext(source('mission-demo'), {
    document: { querySelectorAll: () => [root], createElement: () => element(), activeElement: cards[0] },
    window: { matchMedia: () => ({ matches: reduced }) }, Event: class {},
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
  })
  cards[0].click(); cards[0].click()
  assert.equal(nodes['[data-demo-credit]'].textContent, '20')
  assert.equal(nodes['[data-demo-heart]'].textContent, '2')
  assert.equal(nodes['.demo-finished'].hidden, true)
  assert.equal(nodes['.demo-sparkles'].children.length, reduced ? 0 : 8)
  cards.slice(1).forEach(card => card.click())
  assert.equal(nodes['.demo-finished'].hidden, true, 'replay stays hidden until disappearance finishes')
  timers.splice(0).forEach(timer => timer.fn())
  assert.equal(nodes.progress.value, 5)
  assert.equal(nodes['[data-demo-credit]'].textContent, '60')
  assert.equal(nodes['[data-demo-heart]'].textContent, '6')
  assert.ok(cards.every(card => card.hidden && card.disabled))
  assert.equal(nodes['.demo-finished'].hidden, false)
  assert.equal(nodes['.demo-cards'].hidden, true)
  nodes['.demo-reset'].click()
  assert.ok(cards.every(card => !card.hidden && !card.disabled))
  assert.equal(nodes['[data-demo-credit]'].textContent, '10')
  assert.equal(nodes['.demo-finished'].hidden, true)
  cards[2].click()
  assert.equal(nodes['[data-demo-credit]'].textContent, '20')
})

test('routine keywords toggle the selected list and empty state', () => {
  const chips = ['일어나기', '아침 먹기'].map(name => element({ routine: name }))
  chips.forEach(chip => chip.setAttribute('aria-pressed', 'true'))
  const nodes = Object.fromEntries(['.routine-edit','.routine-keywords','.routine-list','.routine-status'].map(k => [k, element()]))
  nodes['.routine-keywords'].hidden = true
  const root = { querySelector: k => nodes[k], querySelectorAll: () => chips }
  runInNewContext(source('routine-demo'), { document: { querySelectorAll: () => [root], createElement: () => element() } })
  assert.equal(nodes['.routine-list'].children.length, 2)
  nodes['.routine-edit'].click()
  assert.equal(nodes['.routine-keywords'].hidden, false)
  chips[0].click()
  assert.equal(nodes['.routine-list'].children.length, 1)
  assert.match(nodes['.routine-status'].textContent, /일어나기 해제/)
  chips[1].click()
  assert.match(nodes['.routine-list'].children[0].textContent, /키워드를 고르면/)
  chips[0].click()
  assert.equal(nodes['.routine-list'].children[0].children[0].textContent, '일어나기')
  nodes['.routine-edit'].click()
  nodes['.routine-edit'].click()
  assert.equal(chips[0].getAttribute('aria-pressed'), 'true', 'closing editor preserves the selection')
})

test('feature navigation synchronizes explanation, hotspot and parent screen', () => {
  const panels = ['parent-routine','parent-home','parent-market'].map((screen, i) => element({ parentScreen: screen, parentY: String(50+i), featureName: `기능 ${i}` }))
  const selectors = [0,1,2,0,1,2].map(i => element({ tourSelect: String(i) }))
  const jump = element({ tourJump: '2' })
  const nodes = Object.fromEntries(['[data-tour-prev]','[data-tour-next]','[data-parent-preview]','[data-parent-caption]','.parent-hotspot','[data-tour-count]','.tour-announcement'].map(k => [k, element()]))
  const root = { querySelector: k => nodes[k], querySelectorAll: k => k === '[data-tour-panel]' ? panels : selectors, scrollIntoView() {} }
  runInNewContext(source('features'), { document: { querySelectorAll: k => k === '[data-feature-tour]' ? [root] : [jump] }, window: { matchMedia: () => ({ matches: true }) } })
  assert.equal(nodes['[data-tour-prev]'].disabled, true)
  nodes['[data-tour-next]'].click()
  assert.equal(nodes['[data-parent-preview]'].src, '/site/assets/parent-home.webp')
  assert.equal(panels[1].hidden, false)
  assert.equal(selectors[4].getAttribute('aria-pressed'), 'true')
  jump.click()
  assert.equal(nodes['[data-parent-preview]'].src, '/site/assets/parent-market.webp')
  assert.equal(nodes['[data-tour-next]'].disabled, true)
  selectors[0].click()
  assert.equal(panels[0].hidden, false)
  assert.equal(nodes['[data-tour-prev]'].disabled, true)
})

test('card rail respects boundaries and reduced motion', () => {
  const track = element(), prev = element(), next = element()
  track.clientWidth = 300; track.scrollWidth = 900
  let lastScroll
  track.scrollBy = options => { lastScroll = options }
  const root = { querySelector: k => ({ '[data-rail-track]':track, '[data-rail-prev]':prev, '[data-rail-next]':next })[k] }
  runInNewContext(source('card-rail'), { document: { querySelectorAll: () => [root] }, window: { matchMedia: () => ({ matches: true }), addEventListener() {} } })
  assert.equal(prev.disabled, true)
  assert.equal(next.disabled, false)
  next.click()
  assert.equal(lastScroll.left, 240)
  assert.equal(lastScroll.behavior, 'instant')
})
