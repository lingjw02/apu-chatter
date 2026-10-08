import assert from 'node:assert/strict';
import {fixture} from './database-fixture.mjs';
const {db,ids,as,rpc}=await fixture(3);
try{
 await as(0);const group=await rpc('create_group',['Block recovery','','UTC']),invite=await rpc('create_invite',[group]);
 await as(1);await rpc('join_group',[invite.token]);await rpc('set_member_block',[group,ids[0],true]);await rpc('leave_group',[group]);
 const own=await rpc('blocked_accounts');assert.equal(own.length,1);assert.equal(own[0].user_id,ids[0]);assert.equal(typeof own[0].display_name,'string');assert.deepEqual(Object.keys(own[0]).sort(),['display_name','user_id']);
 await as(2);assert.deepEqual(await rpc('blocked_accounts'),[]);await rpc('set_member_block',[null,ids[0],false]);
 await as(1);assert.equal((await rpc('blocked_accounts')).length,1,'Another user cannot remove your block');
 await rpc('set_member_block',[null,ids[0],false]);assert.deepEqual(await rpc('blocked_accounts'),[]);
 await db.exec('reset role;set role anon');await assert.rejects(rpc('blocked_accounts'));
 console.log('PASS: own blocked-account names after leaving all groups, no other-user disclosure/mutation, unblocking without membership and anonymous denial.');
}finally{await db.close();}
