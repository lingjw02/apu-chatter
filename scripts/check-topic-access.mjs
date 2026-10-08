import assert from 'node:assert/strict';
import {fixture} from './database-fixture.mjs';
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1);});
const {db,ids,as,rpc}=await fixture();
try{
 await as(0);const group=await rpc('create_group',['Topics','','UTC']);await rpc('set_group_ai',[group,true]);
 const message=await rpc('send_group_message',[group,crypto.randomUUID(),'Planning the study session']);
 await db.exec('reset role');
 const job=crypto.randomUUID();await db.query("insert into public.ai_jobs(id,group_id,kind,week_start,state)values($1,$2,'weekly','2026-09-14','running')",[job,group]);
 await rpc('complete_weekly_ai',[job,'A study session.',JSON.stringify([message]),false,JSON.stringify([{label:'Study plans',sources:[message]}])]);
 await as(0);const result=await rpc('group_weekly_topics',[group]);assert.equal(result.topics[0].label,'Study plans');assert.equal(result.topics[0].sources.length,1);
 await assert.rejects(rpc('complete_weekly_ai',[job,'Changed','[]',false,'[]']));
 await as(1);await assert.rejects(rpc('group_weekly_topics',[group]));
 await db.exec('reset role');await db.query("update public.group_messages set deleted_at=now(),body='[deleted]' where id=$1",[message]);
 await as(0);assert.equal((await rpc('group_weekly_topics',[group])).topics.length,0);
 console.log('PASS: weekly topics are group-member-only, cannot be client-written, and disappear when a source is deleted.');
}finally{await db.close();}

