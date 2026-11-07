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
    focus() {}, dispatchEvent(event) { events.get(event.type)?.() }, scrollIntoView() {}, remove() {},
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
  const panels = ['parent-routine','parent-home','parent-market'].map((screen, i) => element({ parentScreen: screen, parentY: String(50+i), parentHeight: String(30+i), featureName: `기능 ${i}` }))
  const selectors = [0,1,2,0,1,2].map(i => element({ tourSelect: String(i) }))
  const jump = element({ tourJump: '2', tourTarget: 'family-tour' })
  const nodes = Object.fromEntries(['[data-tour-prev]','[data-tour-next]','[data-parent-preview]','[data-parent-caption]','[data-parent-detail-image]','[data-parent-detail-title]','.parent-detail-crop','.parent-hotspot','[data-tour-count]','.tour-announcement'].map(k => [k, element()]))
  const root = { id: 'family-tour', querySelector: k => nodes[k], querySelectorAll: k => k === '[data-tour-panel]' ? panels : selectors, scrollIntoView() {} }
  runInNewContext(source('features'), { document: { querySelectorAll: k => k === '[data-feature-tour]' ? [root] : [jump] }, window: { matchMedia: () => ({ matches: true }) } })
  assert.equal(nodes['[data-tour-prev]'].disabled, true)
  nodes['[data-tour-next]'].click()
  assert.equal(nodes['[data-parent-preview]'].src, '/site/assets/parent-home.webp')
  assert.equal(panels[1].hidden, false)
  assert.equal(nodes['.parent-hotspot'].style.top, '51%')
  assert.equal(nodes['.parent-hotspot'].style.height, '31%')
  assert.equal(nodes['[data-parent-detail-image]'].src, nodes['[data-parent-preview]'].src)
  assert.equal(nodes['.parent-detail-crop'].style.aspectRatio, `828 / ${1793 * 31 / 100}`)
  assert.equal(selectors[4].getAttribute('aria-pressed'), 'true')
  selectors[2].click()
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

test('child-only tour selects a feature without a parent screen', () => {
  const panels = [element({featureName:'화분'}), element({featureName:'스티커'})];
  const selectors = [element({tourSelect:'0'}), element({tourSelect:'1'})];
  const nodes = Object.fromEntries(['[data-tour-prev]','[data-tour-next]','[data-tour-count]','.tour-announcement'].map(k=>[k,element()]));
  const own = element({tourJump:'1',tourTarget:'child-tour'}), other = element({tourJump:'0',tourTarget:'family-tour'});
  const root = {id:'child-tour',querySelector:k=>nodes[k],querySelectorAll:k=>k==='[data-tour-panel]'?panels:selectors,scrollIntoView(){}};
  runInNewContext(source('features'),{document:{querySelectorAll:k=>k==='[data-feature-tour]'?[root]:[own,other]},window:{matchMedia:()=>({matches:true})}});
  selectors[1].click();
  assert.equal(panels[1].hidden,false);
  assert.equal(selectors[1].getAttribute('aria-pressed'),'true');
});

test('only shared features map to parents; core cards and growth art match their details', () => {
  const html = readFileSync(new URL('../public/site/features.html',import.meta.url),'utf8');
  const family = html.split('id="family-tour"')[1].split('id="child-features"')[0];
  const core = html.split('id="child-tour"')[1].split('class="upcoming-section"')[0];
  assert.equal((family.match(/data-parent-screen=/g)||[]).length,3);
  assert.equal(core.includes('data-parent-screen'),false);
  assert.equal(core.includes('부모 화면에서는'),false);
  assert.equal(core.includes('tablet-shell'),false);
  assert.equal((core.match(/data-tour-panel/g)||[]).length,7);
  assert.equal((core.match(/class="core-card"/g)||[]).length,7);
  for(const stage of [0,1,4,7]) assert.ok(core.includes('apple-stage-'+stage+'.png'));
  for(const tree of ['apple','strawberry','lemon','cherry','blueberry','sunflower']) assert.ok(core.includes(tree+'-grown.png'));
  assert.ok(core.includes('929 이상'));
  assert.ok(core.includes('현재 이용 가능 · 인형뽑기'));
  assert.ok(core.includes('추가 구상 · 아직 이용할 수 없어요'));
});

test('swiping a core card synchronizes its detail and navigation', () => {
  const panels=[element({featureName:'화분'}),element({featureName:'스티커'})];
  const cards=[element({tourSelect:'0'}),element({tourSelect:'1'})];
  cards[0].getBoundingClientRect=()=>({left:-100,width:100});
  cards[1].getBoundingClientRect=()=>({left:0,width:100});
  const rail=element(); rail.clientWidth=100; rail.children=cards;
  rail.getBoundingClientRect=()=>({left:0,width:100});
  const nodes=Object.fromEntries(['[data-tour-prev]','[data-tour-next]','[data-tour-count]','.tour-announcement'].map(k=>[k,element()]));
  nodes['.core-card-rail']=rail;
  const root={id:'child-tour',querySelector:k=>nodes[k],querySelectorAll:k=>k==='[data-tour-panel]'?panels:cards};
  runInNewContext(source('features'),{document:{querySelectorAll:k=>k==='[data-feature-tour]'?[root]:[]},window:{matchMedia:()=>({matches:true})}});
  rail.dispatchEvent({type:'scrollend'});
  assert.equal(panels[1].hidden,false);
  assert.equal(cards[1].getAttribute('aria-pressed'),'true');
  assert.equal(nodes['[data-tour-next]'].disabled,true);
});

 test('selecting a card scrolls only its horizontal rail', () => {
  const panels=[element({featureName:'화분'}),element({featureName:'스티커'})];
  const cards=[element({tourSelect:'0'}),element({tourSelect:'1'})];
  cards.forEach((card,i)=>{card.getBoundingClientRect=()=>({left:20+i*200,width:180});card.scrollIntoView=()=>{throw Error('must not move page vertically')};});
  const rail=element(); rail.clientWidth=200;rail.scrollLeft=0;rail.children=cards;
  rail.getBoundingClientRect=()=>({left:10,width:200});
  let scroll;rail.scrollTo=value=>{scroll=value};
  const nodes=Object.fromEntries(['[data-tour-prev]','[data-tour-next]','[data-tour-count]','.tour-announcement'].map(k=>[k,element()]));nodes['.core-card-rail']=rail;
  const root={querySelector:k=>nodes[k],querySelectorAll:k=>k==='[data-tour-panel]'?panels:cards};
  runInNewContext(source('features'),{document:{querySelectorAll:()=>[root]},window:{matchMedia:()=>({matches:true})}});
  nodes['[data-tour-next]'].click();
  assert.equal(scroll.left,200);assert.equal(scroll.behavior,'instant');assert.equal('top' in scroll,false);
  assert.equal(panels[1].hidden,false);
});

 test('feature selectors work without duplicate arrows and counters', () => {
  const panels=[element({featureName:'미션'}),element({featureName:'성장'})];
  const selectors=[0,1].map(i=>element({tourSelect:String(i)}));
  const status=element();
  const root={querySelector:k=>k==='.tour-announcement'?status:null,querySelectorAll:k=>k==='[data-tour-panel]'?panels:selectors};
  runInNewContext(source('features'),{document:{querySelectorAll:()=>[root]},window:{matchMedia:()=>({matches:true})}});
  selectors[1].click();
  assert.equal(panels[1].hidden,false);
  assert.equal(panels[0].hidden,true);
 });
