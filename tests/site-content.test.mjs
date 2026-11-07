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
      assert.ok(existsSync(resolve(root, '.' + url.split('?')[0])), `missing ${url}`)
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

test('home research links and moved experiences remain connected', () => {
  const home = readFileSync(`${root}/site/index.html`, 'utf8');
  const features = readFileSync(`${root}/site/features.html`, 'utf8');
  assert.ok(!home.includes('data-mission-demo'));
  assert.ok(features.includes('data-mission-demo') && features.includes('data-routine-demo'));
  assert.match(home, /youtube-nocookie.com\/embed\/N8JO8S6UJCE/);
  assert.ok(!home.includes('autoplay=1'));
  for (const id of ['18298272', '23397904', '39102255', '10589297']) assert.ok(home.includes(id));
  for (const html of [home, features]) {
    for (const [, path, hash] of html.matchAll(/href="(\/site\/[^"#]+\.html)#([^"#]+)"/g)) {
      assert.ok(readFileSync(resolve(root, '.' + path), 'utf8').includes(`id="${hash}"`), `missing anchor ${path}#${hash}`);
    }
  }
  assert.ok(features.includes('id="try-missions"'));
});
