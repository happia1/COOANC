// COOANC_LIVE_TEST=1 node tests/child-actions-live-check.mjs
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
assert.equal(process.env.COOANC_LIVE_TEST,'1')
process.loadEnvFile('.env.local')
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const checked=async q=>{const {data,error}=await q;assert.ifError(error);return data}
let childId
let missionId
try {
 const {data,error}=await db.auth.admin.createUser({email:`cooanc-actions-${randomUUID()}@example.com`,password:randomUUID()+'aA1!',email_confirm:true,user_metadata:{role:'child',name:'임시 계산 검증'}})
 assert.ifError(error);childId=data.user.id
 await checked(db.from('child_stats').upsert({child_id:childId,credits:100,hearts:30,current_level:5,pot_tree_id:'apple',pot_stage:0,pot_hearts_used:0}))
 const [mission]=await checked(db.from('missions').insert({linked_child_id:childId,title:'계산 검증',credit_reward:10,heart_reward:2,exp_reward:10,reward_multiplier:2,repeat_type:'daily'}).select())
 missionId=mission.id
 const day='2026-10-26'
 const [daily]=await checked(db.from('daily_missions').insert({child_id:childId,mission_template_id:missionId,date:day}).select())
 const requestId=randomUUID()
 const args={p_child_id:childId,p_daily_id:daily.id,p_request_id:requestId,p_version:0}
 const results=await Promise.all(Array.from({length:5},()=>checked(db.rpc('apply_daily_mission_action',args))))
 let [stats]=await checked(db.from('child_stats').select('*').eq('child_id',childId))
 assert.equal(stats.credits,120);assert.equal(stats.hearts,34);assert.equal(results.filter(x=>!x.replayed).length,1)
 await checked(db.rpc('apply_daily_mission_action',{...args,p_request_id:randomUUID()}))
 ;[stats]=await checked(db.from('child_stats').select('*').eq('child_id',childId));assert.equal(stats.credits,120)
 // A purchase between commit and retry must never be overwritten or mistaken for failed payment.
 await checked(db.from('child_stats').update({credits:90}).eq('child_id',childId))
 const replay=await checked(db.rpc('apply_daily_mission_action',args));assert.equal(replay.stats.credits,90)
 const undoArgs={...args,p_request_id:randomUUID(),p_undo:true,p_recent_only:true}
 await Promise.all([checked(db.rpc('apply_daily_mission_action',undoArgs)),checked(db.rpc('apply_daily_mission_action',undoArgs))])
 ;[stats]=await checked(db.from('child_stats').select('*').eq('child_id',childId));assert.equal(stats.credits,70)
 const old=await db.rpc('apply_daily_mission_action',args);assert.ok(old.error?.message.includes('STALE_COMPLETION'),'late old attempt must be rejected')
 await checked(db.rpc('apply_daily_mission_action',{...args,p_request_id:randomUUID(),p_version:1}))
 ;[stats]=await checked(db.from('child_stats').select('*').eq('child_id',childId));assert.equal(stats.credits,90)
 await checked(db.from('plant_seed_purchases').insert({child_id:childId,tree_id:'apple',credit_cost:0}))
 await checked(db.from('child_stats').update({pot_stage:6,pot_hearts_used:24,hearts:10}).eq('child_id',childId))
 const waterArgs={p_child_id:childId,p_request_id:randomUUID()}
 const waters=await Promise.all(Array.from({length:5},()=>checked(db.rpc('water_child_plant',waterArgs))))
 assert.equal(waters[0].newStage,7)
 const [inventory]=await checked(db.from('plant_harvest_inventory').select('*').eq('child_id',childId))
 assert.equal(inventory.quantity,waters[0].harvest.amount)
 ;[stats]=await checked(db.from('child_stats').select('*').eq('child_id',childId));assert.equal(stats.hearts,9);assert.equal(stats.pot_stage,7)
 const completed=await checked(db.rpc('water_child_plant',{p_child_id:childId,p_request_id:randomUUID()}));assert.equal(completed.code,'PLANT_COMPLETED')
 // Midnight preparation follows the same linked-child, level and weekday/weekend rules.
 await checked(db.from('child_stats').update({current_level:4}).eq('child_id',childId))
 const before={credits:stats.credits,hearts:stats.hearts,pot_stage:stats.pot_stage}
 await checked(db.from('profiles').update({holiday_routine_mode:'custom'}).eq('id',childId))
 const templates=await checked(db.from('missions').insert([
  {linked_child_id:childId,title:'주말 검증',repeat_type:'weekly'},
  {linked_child_id:childId,title:'매일 스페셜 검증',repeat_type:'daily',difficulty:'special'},
  {linked_child_id:childId,title:'일회 스페셜 제외',repeat_type:'event',difficulty:'special'},
  {linked_child_id:childId,title:'레벨 제한 제외',repeat_type:'daily',level_required:5},
 ].map((row)=>({level_required:0,difficulty:'normal',...row}))).select())
 const weekend='2026-10-31'
 assert.equal(await checked(db.rpc('prepare_child_mission_cards',{p_day:weekend,p_child_id:childId})),2)
 assert.equal(await checked(db.rpc('prepare_child_mission_cards',{p_day:weekend,p_child_id:childId})),0)
 const cards=await checked(db.from('daily_missions').select('mission_template_id').eq('child_id',childId).eq('date',weekend))
 assert.deepEqual(new Set(cards.map(x=>x.mission_template_id)),new Set(templates.slice(0,2).map(x=>x.id)))
 const [afterPrepare]=await checked(db.from('child_stats').select('credits,hearts,pot_stage').eq('child_id',childId));assert.deepEqual(afterPrepare,before)
 const childClient=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
 const denied=await childClient.rpc('water_child_plant',waterArgs);assert.ok(denied.error)
 // Force the existing level constraint to fail after log/card writes: the whole action must roll back.
 const [failedDaily]=await checked(db.from('daily_missions').insert({child_id:childId,mission_template_id:missionId,date:'2026-11-01'}).select())
 await checked(db.from('child_stats').update({current_level:99,exp:0,exp_to_next_level:1}).eq('child_id',childId))
 const failed=await db.rpc('apply_daily_mission_action',{p_child_id:childId,p_daily_id:failedDaily.id,p_request_id:randomUUID(),p_version:0})
 assert.ok(failed.error)
 const [afterFailure]=await checked(db.from('daily_missions').select('is_completed').eq('id',failedDaily.id));assert.equal(afterFailure.is_completed,false)
 const failedLogs=await checked(db.from('mission_logs').select('id').eq('child_id',childId).eq('assigned_date','2026-11-01'));assert.equal(failedLogs.length,0)
 const [failedStats]=await checked(db.from('child_stats').select('credits').eq('child_id',childId));assert.equal(failedStats.credits,before.credits)
 console.log('PASS: reward failure rolls back card completion, mission log and balance together')
 console.log('PASS: midnight mission-only preparation, weekend/custom routine, special and level filters, repeat is a no-op, balances and plant unchanged, anonymous internal RPC denied')
 console.log('PASS: concurrent completion once, reward multiplier, balance after intervening spend, undo replay once, stale attempt rejected, re-completion, atomic harvest and water replay')
} finally {
 if(childId){
   if(missionId){await checked(db.from('mission_logs').delete().eq('child_id',childId));await checked(db.from('daily_missions').delete().eq('child_id',childId));await checked(db.from('missions').delete().eq('linked_child_id',childId))}
   const {error}=await db.auth.admin.deleteUser(childId);assert.ifError(error)
   const remaining=await checked(db.from('child_action_receipts').select('child_id').eq('child_id',childId));assert.equal(remaining.length,0)
   console.log('PASS: disposable action test data removed')
 }
}
