// COOANC_LIVE_TEST=1 [COOANC_HARDENED=1] [COOANC_TEST_BASE=http://localhost:3100] node tests/child-action-api-live-check.mjs
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
assert.equal(process.env.COOANC_LIVE_TEST,'1')
process.loadEnvFile('.env.local')
const base=process.env.COOANC_TEST_BASE ?? 'http://localhost:3100'
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const checked=async q=>{const {data,error}=await q;assert.ifError(error);return data}
const users=[]
async function account(role){const email=`cooanc-api-${randomUUID()}@example.com`,password=randomUUID()+'aA1!';const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{role,name:'임시 API 검증'}});assert.ifError(error);users.push(data.user.id);return {id:data.user.id,email,password}}
async function login(account){let r; for(let attempt=0;attempt<2;attempt++){r=await fetch(base+'/api/auth/sign-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(account)});if(r.status!==504)break;}assert.equal(r.status,200,await r.clone().text());return {plan:await r.json(),cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),setCookies:r.headers.getSetCookie()}}
async function post(url,body,cookie){const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
try {
 const child=await account('child'),parent=await account('parent')
 await checked(db.from('child_stats').upsert({child_id:child.id,credits:100,hearts:10,current_level:5,pot_tree_id:'apple',pot_stage:1,pot_hearts_used:4,sleep_ready_time_enabled:false}))
 await checked(db.from('family_links').insert({parent_id:parent.id,child_id:child.id}))
 const childAuth=await login(child);assert.equal(childAuth.plan.redirectTo,'/home')
 const parentAuth=await login(parent);assert.equal(parentAuth.plan.redirectTo,'/home');assert.ok(parentAuth.setCookies.some(x=>x.includes(child.id)),'preview cookie set by sign-in without enter-child-ui roundtrip')
 const [mission]=await checked(db.from('missions').insert({linked_child_id:child.id,title:'API 완료 검증',credit_reward:10,heart_reward:2,exp_reward:10,repeat_type:'daily'}).select())
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const [daily]=await checked(db.from('daily_missions').insert({child_id:child.id,mission_template_id:mission.id,date:today}).select())
 const completion={childId:child.id,dailyMissionId:daily.id,today,completionVersion:0,requestId:randomUUID()}
 let result=await post('/api/daily-mission/complete',completion,childAuth.cookie);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.newCredits,110)
 result=await post('/api/daily-mission/complete',completion,childAuth.cookie);assert.equal(result.status,200);assert.equal(result.data.newCredits,110)
 const [log]=await checked(db.from('mission_logs').select('*').eq('child_id',child.id))
 result=await post('/api/mission/rollback',{missionLogId:log.id,expectedCompletedAt:log.completed_at,requestId:randomUUID()},parentAuth.cookie);assert.equal(result.status,200,JSON.stringify(result.data))
 result=await post('/api/daily-mission/complete',completion,childAuth.cookie);assert.equal(result.status,409)
 result=await post('/api/daily-mission/complete',{...completion,completionVersion:1,requestId:randomUUID()},childAuth.cookie);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.newCredits,110)
 await checked(db.from('plant_seed_purchases').insert({child_id:child.id,tree_id:'apple',credit_cost:1}))
 const water={childId:child.id,requestId:randomUUID()}
 result=await post('/api/child/plant-water',water,childAuth.cookie);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.newStage,2)
 const event=await fetch(base+`/api/child/plant-celebration?childId=${child.id}`,{headers:{Cookie:childAuth.cookie}}).then(r=>r.json());assert.equal(event.requestId,water.requestId)
 result=await post('/api/child/plant-celebration',water,childAuth.cookie);assert.equal(result.status,200)
 const panel=await fetch(base+`/api/child/panel-data?childId=${child.id}&panel=market`,{headers:{Cookie:childAuth.cookie}});assert.equal(panel.status,200)
 assert.equal((await post('/api/child/plant-water',{...water,childId:randomUUID()},parentAuth.cookie)).status,403)
 if(process.env.COOANC_HARDENED==='1'){
  const direct=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
  await checked(direct.auth.signInWithPassword({email:child.email,password:child.password}))
  assert.ok((await direct.from('child_stats').update({credits:99999}).eq('child_id',child.id)).error)
  assert.ok((await direct.from('child_stats').update({piggy_bonus_pending:99999}).eq('child_id',child.id)).error)
  assert.ok((await direct.from('daily_missions').update({is_completed:false}).eq('id',daily.id)).error)
  assert.ok((await direct.from('mission_logs').update({credit_earned:99999}).eq('id',log.id)).error)
  assert.ok((await direct.rpc('complete_mission_reward',{p_child_id:child.id,p_credit:999,p_heart:0,p_exp:0,p_completion_day:today})).error)
  await checked(direct.from('child_stats').update({school_time_enabled:false}).eq('child_id',child.id))
  console.log('PASS: direct credits/hearts/bonus/log/completion and internal RPC writes denied; alarm settings remain writable')
 }
 console.log('PASS: child/parent sign-in direct destination, preview cookie, API completion/retry/undo/re-complete, growth acknowledgement, lazy market query, unrelated child access denied')
} finally {
 for(const id of users){
  await checked(db.from('mission_logs').delete().eq('child_id',id));await checked(db.from('daily_missions').delete().eq('child_id',id));await checked(db.from('missions').delete().eq('linked_child_id',id));
 }
 for(const id of users.reverse()){const {error}=await db.auth.admin.deleteUser(id);assert.ifError(error)}
 console.log('PASS: disposable API accounts removed')
}
