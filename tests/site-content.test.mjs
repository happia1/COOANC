import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '../public')
for (const page of ['index', 'features', 'guide', 'contact', 'about']) {
  test(`${page} has complete assets and sharing metadata`, () => {
    const html = readFileSync(`${root}/site/${page}.html`, 'utf8')
    assert.match(html, /property="og:image"/)
    assert.match(html, /name="twitter:card" content="summary_large_image"/)
    assert.doesNotMatch(html, /이미지 자리|data-install[\s=>]|id="iosOverlay"/)
    for (const [, url] of html.matchAll(/(?:src|href)="(\/site\/[^"#]+)(?:#[^"]*)?"/g)) {
      assert.ok(existsSync(resolve(root, '.' + url)), `missing ${url}`)
    }
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
    assert.equal(ids.length, new Set(ids).size, 'duplicate ids')
  })
}
test('install instructions open the app, not the guide shortcut', () => {
  const html = readFileSync(`${root}/site/guide.html`, 'utf8')
  assert.match(html, /href="https:\/\/cooanc.vercel.app\/"[^>]*>앱 열고 설치하기/)
  assert.match(html, /앱을 연 뒤/)
})
