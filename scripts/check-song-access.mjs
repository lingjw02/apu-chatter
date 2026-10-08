import assert from 'node:assert/strict';
import {fixture} from './database-fixture.mjs';
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1);});
const {db,as,rpc}=await fixture();
try{await as(0);const g=await rpc('create_group',['Song search','','UTC']);await assert.rejects(rpc('request_ai_job',[g,'song',crypto.randomUUID()]));await rpc('set_group_ai',[g,true]);
 const key=crypto.randomUUID(),job=await rpc('request_ai_job',[g,'song',key]);assert.equal(await rpc('request_ai_job',[g,'song',key]),job);await rpc('request_ai_job',[g,'summary',crypto.randomUUID()]);await rpc('request_ai_job',[g,'song',crypto.randomUUID()]);await assert.rejects(rpc('request_ai_job',[g,'song',crypto.randomUUID()]));
 await rpc('music_action',[g,'join',JSON.stringify({connection:crypto.randomUUID()})]);await rpc('music_action',[g,'add',JSON.stringify({provider:'apple',kind:'track',external_id:'my:456:123',title:'Test song'})]);
 await assert.rejects(rpc('music_action',[g,'add',JSON.stringify({provider:'apple',kind:'track',external_id:'https://evil.example',title:'Bad'})]));
 await as(1);await assert.rejects(rpc('request_ai_job',[g,'song',crypto.randomUUID()]));assert.equal((await db.query('select * from public.ai_jobs')).rows.length,0);
 console.log('PASS: song opt-in, membership, shared AI quota, retry identity and Apple queue validation.');
}finally{await db.close();}
