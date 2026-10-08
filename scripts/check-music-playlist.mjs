import assert from 'node:assert/strict';
import {fixture} from './database-fixture.mjs';
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1);});
const {db,ids,as,rpc}=await fixture(3);
try{
 await as(0);const group=await rpc('create_group',['Playlist','','UTC']),invite=await rpc('create_invite',[group]);await as(1);await rpc('join_group',[invite.token]);
 const act=(action,payload={})=>rpc('music_action',[group,action,payload]);await as(0);await act('join',{connection:crypto.randomUUID()});
 let state=await act('add',{provider:'youtube',kind:'playlist',external_id:'PLUl4u3cNGP63EdVPNLG3ToM6LaEUuStEY',title:'Playlist check'});
 const payload={revision:state.session.revision,item_id:state.session.current_id,index:1,video_id:'M7lc1UVf-VE',position:2};
 state=await act('playlist_track',payload);assert.equal(state.session.playlist_index,1);assert.equal(state.session.playlist_video_id,'M7lc1UVf-VE');assert.equal(state.session.position,2);assert.equal(state.session.playing,false);
 await assert.rejects(act('playlist_track',payload),/STALE_REVISION/);
 const revision=state.session.revision;state=await act('playlist_track',{...payload,revision});assert.equal(state.session.revision,revision,'Duplicate observed track must not restart the session clock');
 for(const bad of [{index:-1},{index:10000},{index:1.5},{video_id:'invalid video!'},{item_id:crypto.randomUUID()},{position:-1},{position:86401}])await assert.rejects(act('playlist_track',{...payload,revision,...bad}),undefined,JSON.stringify(bad));
 await as(1);await act('join',{connection:crypto.randomUUID()});await assert.rejects(act('playlist_track',{...payload,revision}),/HOST_ONLY/);
 await as(2);await assert.rejects(act('playlist_track',{...payload,revision}),/FORBIDDEN/);
 await as(0);state=await act('transfer',{revision,user_id:ids[1]});assert.equal(state.session.playlist_index,1);assert.equal(state.session.playlist_video_id,'M7lc1UVf-VE');
 await as(1);state=await act('add',{provider:'youtube',kind:'track',external_id:'M7lc1UVf-VE',title:'Next track'});state=await act('next',{revision:state.session.revision});assert.equal(state.session.playlist_index,0);assert.equal(state.session.playlist_video_id,null);
 await assert.rejects(act('playlist_track',{...payload,revision:state.session.revision,item_id:state.session.current_id}),/INVALID_PLAYLIST/);
 console.log('PASS: playlist host/revision/item binding, index/video/position validation, duplicate observation, transfer preservation and next-item reset.');
}finally{await db.close();}
