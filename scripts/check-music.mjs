import assert from 'node:assert/strict';import {fixture} from './database-fixture.mjs';
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1);});
const {db,ids,as,rpc}=await fixture();
await as(0);const group=await rpc('create_group',['Music','','UTC']),invite=await rpc('create_invite',[group]);for(const i of [1,2]){await as(i);await rpc('join_group',[invite.token]);}
const connections=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];const act=(action,payload={})=>rpc('music_action',[group,action,payload]);
await as(0);let state=await act('join',{connection:connections[0]});assert.equal(state.session.host_id,ids[0]);
await act('add',{provider:'youtube',kind:'track',external_id:'dQw4w9WgXcQ',title:'Track one'});state=await act('add',{provider:'spotify',kind:'track',external_id:'1234567890123456789012',title:'Track two'});assert.equal(state.queue.length,2);
await assert.rejects(act('add',{provider:'evil',kind:'track',external_id:'https://example.com'}));
await as(1);await act('join',{connection:connections[1]});await assert.rejects(act('play',{revision:state.session.revision}));await as(2);state=await act('join',{connection:connections[2]});
await as(0);state=await act('play',{revision:state.session.revision});assert.equal(state.session.playing,true);await assert.rejects(act('pause',{revision:0}));
const track=state.session.current_id;await as(1);state=await act('skip',{track});assert.equal(state.session.current_id,track);await as(2);state=await act('skip',{track});assert.notEqual(state.session.current_id,track);
await as(0);state=await act('leave',{connection:connections[0]});assert.equal(state.session.host_id,ids[1]);
await as(3);await assert.rejects(rpc('music_state',[group]));await assert.rejects(act('join',{connection:crypto.randomUUID()}));
await as(1);await assert.rejects(act('join',{connection:crypto.randomUUID()}));await act('leave',{connection:connections[1]});await as(2);state=await act('leave',{connection:connections[2]});assert.equal(state.session,null);assert.equal(state.queue.length,0);
console.log('PASS: music authorization, queue validation, host control/revisions, majority skip, succession and empty-session cleanup.');await db.close();
