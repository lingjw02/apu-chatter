import assert from 'node:assert/strict';
import {fixture} from './database-fixture.mjs';
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1);});
const {db,ids,as,rpc}=await fixture();
try{
 // Execute the installed SQL definitions in PGlite with only now() replaced.
 // Production has no caller-controlled clock or test-only scheduling endpoint.
 const definitions=[];
 for(const name of ['claim_weekly_ai','claim_ai_job','ai_job_context'])definitions.push((await db.query("select pg_get_functiondef(oid) as sql from pg_proc where pronamespace='public'::regnamespace and proname=$1",[name])).rows[0].sql);
 async function clock(iso){assert.match(iso,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);await db.exec('reset role');for(const sql of definitions)await db.exec(sql.replaceAll('now()',`'${iso}'::timestamptz`));}
 async function group(tz){await as(0);const id=await rpc('create_group',['Scheduler test','',tz]);await rpc('set_group_ai',[id,true]);await db.exec('reset role');return id;}
 async function message(g,time,deleted=false){const id=crypto.randomUUID();await db.query("insert into public.group_messages(id,group_id,author_id,client_id,body,created_at,deleted_at)values($1,$2,$3,$4,'Study plans',$5,case when $6 then $5::timestamptz else null end)",[id,g,ids[0],crypto.randomUUID(),time,deleted]);return id;}
 for(const c of [
  {tz:'Asia/Kuala_Lumpur',before:'2026-09-21T00:59:59Z',due:'2026-09-21T01:00:00Z',start:'2026-09-13T16:00:00Z',end:'2026-09-20T16:00:00Z',week:'2026-09-14'},
  {tz:'America/New_York',before:'2026-03-09T12:59:59Z',due:'2026-03-09T13:00:00Z',start:'2026-03-02T05:00:00Z',end:'2026-03-09T04:00:00Z',week:'2026-03-02'},
  {tz:'America/New_York',before:'2026-11-02T13:59:59Z',due:'2026-11-02T14:00:00Z',start:'2026-10-26T04:00:00Z',end:'2026-11-02T05:00:00Z',week:'2026-10-26'},
 ]){
  const g=await group(c.tz),included=await message(g,c.start);await message(g,c.end);
  await clock(c.before);assert.deepEqual(await rpc('claim_weekly_ai'),[],'Must wait until local Monday 09:00');
  await clock(c.due);const jobs=await rpc('claim_weekly_ai');assert.equal(jobs.length,1);assert.equal(jobs[0].week_start,c.week);assert.equal(jobs[0].attempts,1);
  assert.deepEqual((await rpc('ai_job_context',[jobs[0].id])).map(m=>m.id),[included],'Context includes week start but excludes following Monday');
  assert.deepEqual(await rpc('claim_weekly_ai'),[],'Repeated tick must not start a second worker');
  await rpc('complete_ai_job',[jobs[0].id,'done','Finished','[]',false]);assert.deepEqual(await rpc('claim_weekly_ai'),[],'Completed week must not repeat');
  await db.query('delete from public.groups where id=$1',[g]);
 }
 await clock('2026-09-21T09:00:00Z');const g=await group('UTC');await message(g,'2026-09-15T12:00:00Z');let [job]=await rpc('claim_weekly_ai');
 await clock('2026-09-21T09:06:00Z');assert.deepEqual(await rpc('claim_weekly_ai'),[],'Crashed worker enters cooldown');
 assert.equal((await db.query('select state from public.ai_jobs where id=$1',[job.id])).rows[0].state,'failed');
 await clock('2026-09-21T10:06:00Z');assert.deepEqual(await rpc('claim_weekly_ai'),[],'Retry waits more than an hour');
 await clock('2026-09-21T10:06:01Z');[job]=await rpc('claim_weekly_ai');assert.equal(job.attempts,2);
 await clock('2026-09-21T10:12:00Z');await rpc('claim_weekly_ai');await clock('2026-09-21T12:00:00Z');assert.deepEqual(await rpc('claim_weekly_ai'),[],'No third attempt');
 await db.query('delete from public.groups where id=$1',[g]);
 const empty=await group('UTC'),deleted=await group('UTC'),disabled=await group('UTC');await message(deleted,'2026-09-15T12:00:00Z',true);await message(disabled,'2026-09-15T12:00:00Z');await db.query('update public.groups set ai_enabled=false where id=$1',[disabled]);assert.deepEqual(await rpc('claim_weekly_ai'),[],'Empty, deleted-only and disabled groups do not consume AI');
 await as(0);await assert.rejects(rpc('claim_weekly_ai'),'Members cannot invoke global scheduler');
 console.log('PASS: local Monday 09:00, both DST boundaries, half-open weekly context, duplicate prevention, crash cooldown, two-attempt cap, empty/deleted/disabled skips and service-only access. SQL clock substituted only in isolated test.');
}finally{await db.close();}
