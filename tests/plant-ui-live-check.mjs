// COOANC_LIVE_TEST=1 COOANC_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs node tests/plant-ui-live-check.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
assert.equal(process.env.COOANC_LIVE_TEST,'1')
const { chromium } = await import(process.env.COOANC_PLAYWRIGHT_PATH ?? 'playwright')
const require=createRequire(process.cwd()+'/package.json')
const {createClient}=require('@supabase/supabase-js')
process.loadEnvFile('.env.local')
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
let childId,browser
const checked=async q=>{const {data,error}=await q;assert.ifError(error);return data}
try {
 const email=`cooanc-ui-${randomUUID()}@example.com`,password=randomUUID()+'aA1!'
 const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{role:'child',name:'화분 반응 검증'}});assert.ifError(error);childId=data.user.id
 await checked(db.from('child_stats').upsert({child_id:childId,current_level:5,hearts:15,credits:100,pot_tree_id:'apple',pot_stage:1,pot_hearts_used:4,sleep_ready_time_enabled:false,school_time_enabled:false}))
 await checked(db.from('plant_seed_purchases').insert({child_id:childId,tree_id:'apple',credit_cost:1}))
 browser=await chromium.launch({headless:true})
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const panelRequests=[];page.on('request',r=>{if(r.url().includes('/api/child/panel-data'))panelRequests.push(r.url())})
 const login=await page.request.post('http://localhost:3100/api/auth/sign-in',{data:{email,password}})
 assert.equal(login.status(),200,await login.text())
 const plan=await login.json();assert.equal(plan.redirectTo,'/home')
 const started=performance.now();await page.goto('http://localhost:3100/home');await page.getByRole('button',{name:/화분|식물/}).first().waitFor({timeout:40000})
 console.log('home ready ms',Math.round(performance.now()-started))
 await page.screenshot({path:'/tmp/cooanc-home-check.png'})
 console.log('errors',errors)
 await page.getByRole('button',{name:/화분|식물/}).first().click()
 await page.getByRole('button',{name:/물 주기/}).waitFor()
 await page.addInitScript(()=>{})
 await page.evaluate(()=>{
  window.__plantTimes={}
  document.addEventListener('click',e=>{if(e.target.closest('button')?.getAttribute('aria-label')?.startsWith('물 주기'))window.__plantTimes.click=performance.now()},true)
  new MutationObserver(()=>{const heart=document.querySelector('[style*="plantPotHeartArc"]');if(heart&&!window.__plantTimes.heart)window.__plantTimes.heart=performance.now()}).observe(document.body,{subtree:true,childList:true})
 })
 await page.route('**/api/child/plant-water',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,2000));await route.fulfill({response})})
 await page.getByRole('button',{name:/물 주기/}).click()
 await page.waitForFunction(()=>window.__plantTimes.heart)
 const times=await page.evaluate(()=>window.__plantTimes)
 console.log('tap to heart DOM ms',Math.round(times.heart-times.click));assert.ok(times.heart-times.click<300)
 console.log('PASS: heart appears before deliberately delayed water response')
 await page.getByRole('button',{name:'물 주러가기',exact:true}).waitFor({timeout:20000})
 await page.screenshot({path:'/tmp/cooanc-water-check.png'})
 const rows=await checked(db.from('child_stats').select('hearts,pot_stage').eq('child_id',childId))
 assert.equal(rows[0].hearts,14);assert.equal(rows[0].pot_stage,2)
 await page.reload()
 await page.getByRole('button',{name:'물 주러가기',exact:true}).waitFor({timeout:20000})
 await page.getByRole('button',{name:'물 주러가기',exact:true}).click()
 await page.getByRole('button',{name:'물 주러가기',exact:true}).waitFor({state:'hidden'})
 await page.reload()
 await page.getByRole('button',{name:/화분:/}).waitFor({timeout:20000})
 await page.waitForTimeout(1500)
 assert.equal(await page.getByRole('button',{name:'물 주러가기',exact:true}).count(),0)
 console.log('PASS: confirmed growth popup, unacknowledged event recovered on reload, acknowledgement prevents repeat')
 assert.equal(panelRequests.length,0,'closed panels must not fetch their inventories')
 const [marketResponse]=await Promise.all([
  page.waitForResponse(r=>r.url().includes('/api/child/panel-data')&&r.url().includes('panel=market')),
  page.getByRole('button',{name:'마켓 열기',exact:true}).click(),
 ])
 assert.equal(marketResponse.status(),200)
 const market=await marketResponse.json();assert.ok(market.items.length)
 await page.getByText(market.items[0].name,{exact:true}).first().waitFor({timeout:15000})
 console.log('PASS: no closed-panel inventory requests; market fetched and rendered only after icon tap')
 assert.deepEqual(errors,[])
} finally {
 await browser?.close()
 if(childId){await checked(db.from('daily_missions').delete().eq('child_id',childId));await checked(db.from('missions').delete().eq('linked_child_id',childId));const {error}=await db.auth.admin.deleteUser(childId);assert.ifError(error);console.log('PASS: UI check account removed')}
}
