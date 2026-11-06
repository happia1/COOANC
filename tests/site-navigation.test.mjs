import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('site menu exposes its state, closes on Escape and after choosing a link', () => {
  const attrs = new Map(), classes = new Set(), handlers = new Map()
  let focused = false
  const nav = {
    classList: {
      contains: name => classes.has(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
    },
    addEventListener: (event, fn) => handlers.set('nav:' + event, fn),
  }
  const toggle = {
    setAttribute: (key, value) => attrs.set(key, value),
    addEventListener: (event, fn) => handlers.set('toggle:' + event, fn),
    focus: () => { focused = true },
  }
  runInNewContext(readFileSync(new URL('../public/site/js/main.js', import.meta.url), 'utf8'), {
    document: {
      getElementById: id => ({ navToggle: toggle, navMobile: nav })[id] ?? null,
      querySelectorAll: () => [],
      addEventListener: (event, fn) => handlers.set('document:' + event, fn),
    },
    window: { matchMedia: () => ({ addEventListener: (event, fn) => handlers.set('desktop:' + event, fn) }), addEventListener() {} }, navigator: { userAgent: '' },
    IntersectionObserver: class { observe() {} },
  })
  assert.equal(attrs.get('aria-expanded'), 'false')
  handlers.get('toggle:click')()
  assert.equal(attrs.get('aria-expanded'), 'true')
  assert.equal(attrs.get('aria-label'), '메뉴 닫기')
  handlers.get('document:keydown')({ key: 'Escape' })
  assert.equal(classes.has('open'), false)
  assert.equal(attrs.get('aria-expanded'), 'false')
  assert.equal(focused, true)
  handlers.get('toggle:click')()
  handlers.get('nav:click')({ target: { closest: () => ({}) } })
  assert.equal(classes.has('open'), false)
  assert.equal(attrs.get('aria-label'), '메뉴 열기')
  handlers.get('toggle:click')()
  handlers.get('desktop:change')({ matches: true })
  assert.equal(classes.has('open'), false)
  assert.equal(attrs.get('aria-expanded'), 'false')
})

for (const succeeds of [true, false]) {
  test(`email copy reports ${succeeds ? 'success' : 'failure'}`, async () => {
    let click, copied
    const status = { textContent: '' }
    const button = { dataset: { copyEmail: 'theotter@naver.com' }, addEventListener: (_, fn) => { click = fn } }
    runInNewContext(readFileSync(new URL('../public/site/js/main.js', import.meta.url), 'utf8'), {
      document: {
        getElementById: id => id === 'emailCopyStatus' ? status : null,
        querySelectorAll: selector => selector === '[data-copy-email]' ? [button] : [],
      },
      navigator: { clipboard: { writeText: async value => { if (!succeeds) throw Error('denied'); copied = value } } },
      IntersectionObserver: class { observe() {} },
    })
    await click()
    if (succeeds) assert.equal(copied, 'theotter@naver.com')
    assert.match(status.textContent, succeeds ? /복사했어요/ : /직접 선택/)
  })
}
