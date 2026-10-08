import assert from 'node:assert/strict';import {fixture} from './database-fixture.mjs';
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1);});
const {db,ids,as,rpc}=await fixture();await as(0);const group=await rpc('create_group',['Voice','','UTC']),invite=await rpc('create_invite',[group]);for(const i of [1,2,3,4]){await as(i);await rpc('join_group',[invite.token]);}
const sessions=Array.from({length:6},()=>crypto.randomUUID());for(const i of [0,1,2,3]){await as(i);await rpc('join_voice',[group,sessions[i]]);}
await as(4);await assert.rejects(rpc('join_voice',[group,sessions[4]]));await as(5);await assert.rejects(rpc('join_voice',[group,sessions[5]]));
await as(0);for(let i=0;i<6;i++)await rpc('claim_voice_ice',[sessions[0]]);await assert.rejects(rpc('claim_voice_ice',[sessions[0]]));await as(1);await assert.rejects(rpc('claim_voice_ice',[sessions[0]]));
await as(0);await rpc('send_voice_signal',[sessions[0],sessions[1],{type:'offer',sdp:'synthetic test only'}]);assert.equal((await db.query('select * from public.voice_signals')).rows.length,0);
await as(1);assert.equal((await db.query('select * from public.voice_signals')).rows.length,1);await as(2);assert.equal((await db.query('select * from public.voice_signals')).rows.length,0);await assert.rejects(rpc('send_voice_signal',[sessions[0],sessions[1],{type:'answer',sdp:'spoof'}]));
await as(0);await rpc('leave_voice',[sessions[0]]);await as(4);await rpc('join_voice',[group,sessions[4]]);await as(1);assert.equal((await db.query('select * from public.voice_signals')).rows.length,0);
await db.exec('reset role');await db.query('delete from public.memberships where group_id=$1 and user_id=$2',[group,ids[1]]);await as(1);await assert.rejects(rpc('heartbeat_voice',[sessions[1]]));assert.equal((await db.query('select * from public.voice_members')).rows.length,0);
console.log('PASS: voice four-person capacity, outsider/spoof rejection, recipient-only signaling, leave and removal cleanup.');await db.close();
