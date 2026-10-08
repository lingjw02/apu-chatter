import {readFile} from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, firefox, webkit, expect } from '@playwright/test';
const browserName=process.env.TEST_BROWSER||'chromium';
const browserType={chromium,firefox,webkit}[browserName];
if(!browserType)throw new Error('TEST_BROWSER must be chromium, firefox or webkit');
process.env.VITE_SUPABASE_URL='https://chatter-test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY='public-test-key';
const server=await createServer({server:{host:'127.0.0.1',port:5176,strictPort:true}});
await server.listen();
const browser=await browserType.launch();
console.log(`Connected UI browser: ${browserName}`);
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(20000);
 if(process.env.TEST_HISTORY_TRACE){
  page.on('request',r=>{const u=new URL(r.url());if(u.pathname.endsWith('/group_messages'))console.log('HISTORY request',u.searchParams.get('or')||'latest',u.searchParams.has('id')?'deletion check':'page');});
  page.on('console',m=>{if(m.text().startsWith('HISTORY'))console.log(m.text());});
  await page.addInitScript(()=>window.addEventListener('focus',()=>console.log('HISTORY focus')));
 }
 const uid='11111111-1111-4111-8111-111111111111',gid='22222222-2222-4222-8222-222222222222';
 const user={id:uid,aud:'authenticated',role:'authenticated',email:'test@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{display_name:'Alice'},created_at:new Date().toISOString()};
 const groups=[],messages=[],votes=[],bans=[],privateChats=[],privateMessages=[],content=[],boardTabs=[],boardShapes=[],aiJobs=[];const profile={id:uid,display_name:'Alice',bio:'',status:''};
 const bob={id:'33333333-3333-4333-8333-333333333333',display_name:'Bob',bio:'',status:''};
 const music={session:null,queue:[],listeners:[],votes:0,voted:false,server_time:new Date().toISOString()};
 const seenContent=new Set();
 let nextFailure=false;let nextAttempts=0;
 let bobRemoved=false;let playlistFailure=false;let playlistAttempts=0;
 const blockedAccounts=[{user_id:'44444444-4444-4444-8444-444444444444',display_name:'Former classmate'}];let unblockFailure=false;
 let boardFailure='';
 let overlapHistoryRefresh=false;
 let messageFailure='';const sendAttempts=[];
 let privateFailure='';const privateAttempts=[];
 const token=[{alg:'HS256',typ:'JWT'},{sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'},'signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
 await page.addInitScript(({user,token})=>localStorage.setItem('sb-chatter-test-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
 await page.route('https://www.youtube.com/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:`window.YT={Player:class{constructor(node,options){this.time=0;this.state=2;this.index=0;this.options=options;this.list=['M7lc1UVf-VE','dQw4w9WgXcQ'];if(options.playerVars.list)window.__playlist=this;else window.__video=this;setTimeout(()=>options.events.onReady(),0);}destroy(){}getCurrentTime(){return this.time;}getPlayerState(){return this.state;}getPlaylist(){return this.list;}getPlaylistIndex(){return this.index;}getVideoData(){return {video_id:this.list[this.index]};}cuePlaylist(o){this.index=o.index;this.time=o.startSeconds||0;this.state=5;this.options.events.onStateChange?.({data:5});}playVideoAt(i){this.index=i;this.time=0;this.state=1;this.options.events.onStateChange?.({data:1});}seekTo(t){this.time=t;}playVideo(){this.state=1;window.__musicPlayed=true;}pauseVideo(){this.state=2;}}};window.onYouTubeIframeAPIReady();`}));
 await page.route('https://open.spotify.com/embed/iframe-api/v1',route=>route.fulfill({contentType:'application/javascript',body:`window.onSpotifyIframeApiReady({createController(node,options,callback){const listeners={};const state={isPaused:true,isBuffering:false,duration:16000,position:0,playingURI:options.uri};window.__spotify={plays:0,seeks:[],pauses:0,emit(update){Object.assign(state,update);listeners.playback_update?.({data:{...state}});}};callback({addListener(name,fn){listeners[name]=fn;if(name==='ready')setTimeout(fn,0);},play(){window.__spotify.plays++;window.__spotify.emit({isPaused:false});},pause(){window.__spotify.pauses++;window.__spotify.emit({isPaused:true});},seek(seconds){window.__spotify.seeks.push(seconds);window.__spotify.emit({position:seconds*1000});},destroy(){window.__spotifyDestroyed=true;}});}});`}));
 await page.routeWebSocket('**/realtime/**',ws=>ws.close());
 await page.route('https://chatter-test.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());let data={};
  if(overlapHistoryRefresh&&url.pathname.endsWith('/group_messages')&&url.searchParams.has('or')){
   overlapHistoryRefresh=false;
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  }
  if(url.pathname.includes('/storage/v1/object/authenticated/profile-avatars/')){await route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAOUlEQVR4nO3RwQkAMAzDQBc6d7p6R1A+/ukGcEA5mZemW12PBxb8ATIRMhEyETIRMhEyETIRMlHIBwIIAXu5uNt2AAAAAElFTkSuQmCC','base64')});return;}
  if(url.pathname.endsWith('/functions/v1/upload-avatar')){profile.avatar_path=uid+'/avatar';data={path:profile.avatar_path};}
  else if(url.pathname.endsWith('/rpc/remove_avatar'))profile.avatar_path=null;
  else if(url.pathname==='/auth/v1/user')data=user;
  else if(url.pathname.endsWith('/functions/v1/find-song'))data={state:'done',query:'Daft Punk Get Lucky',matches:[{provider:'apple',kind:'track',external_id:'my:617154241:617154366',title:'Get Lucky',artist:'Daft Punk',album:'Random Access Memories'}]};
  else if(url.pathname.endsWith('/rpc/music_state'))data=music;
  else if(url.pathname.endsWith('/rpc/music_action')){const a=req.postDataJSON(),p=a.p_payload;
   if(a.p_action==='join'){music.session={host_id:uid,current_id:null,playing:false,position:0,revision:1,updated_at:new Date().toISOString()};music.listeners=[{user_id:uid,name:'Alice'}];}
   if(a.p_action==='add'){const item={...p,id:crypto.randomUUID()};music.queue.push(item);music.session.current_id??=item.id;}
   if(a.p_action==='playlist_track'){playlistAttempts++;if(playlistFailure){playlistFailure=false;await route.fulfill({status:503,json:{message:'Playlist interrupted'}});return;}music.session.playlist_index=p.index;music.session.playlist_video_id=p.video_id;music.session.position=p.position||0;music.session.revision++;music.session.updated_at=new Date().toISOString();music.server_time=music.session.updated_at;}
   if(a.p_action==='play')music.session.playing=true;
   if(a.p_action==='pause')music.session.playing=false;
   if(a.p_action==='next'){nextAttempts++;if(nextFailure){nextFailure=false;await route.fulfill({status:503,json:{message:'Next item interrupted'}});return;}music.queue.shift();music.session.current_id=music.queue[0]?.id||null;music.session.playing=false;}
   if(a.p_action==='leave'){music.session=null;music.queue=[];music.listeners=[];}
   data=music;
  }
  else if(url.pathname.endsWith('/groups'))data=req.headers().accept?.includes('vnd.pgrst.object')?groups[0]:groups;
  else if(url.pathname.endsWith('/profiles')){
   if(req.method()==='PATCH'){Object.assign(profile,req.postDataJSON());data=null;}
   else data=req.headers().accept?.includes('vnd.pgrst.object')?profile:[profile,bob];
  }else if(url.pathname.endsWith('/memberships'))data=[{user_id:uid,role:'owner'},...(!bobRemoved?[{user_id:bob.id,role:'member'}]:[])];
  else if(url.pathname.endsWith('/private_chats'))data=req.headers().accept?.includes('vnd.pgrst.object')?(privateChats[0]||null):privateChats.filter(c=>c.state!=='closed');
else if(url.pathname.endsWith('/private_messages')){data=[...privateMessages].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));const cursor=/created_at.lt.([^,]+),and\(created_at.eq.[^,]+,id.lt.([^\)]+)/.exec(url.searchParams.get('or')||'');if(cursor)data=data.filter(c=>c.created_at<cursor[1]||(c.created_at===cursor[1]&&c.id<cursor[2]));if(url.searchParams.get('limit'))data=data.slice(0,Number(url.searchParams.get('limit')));}
else if(url.pathname.endsWith('/rpc/request_private_chat')){const c={id:crypto.randomUUID(),requester_id:uid,recipient_id:bob.id,state:'pending',expires_at:new Date(Date.now()+86400000).toISOString()};privateChats.push(c);data=c.id;}
else if(url.pathname.endsWith('/rpc/respond_private_chat'))privateChats[0].state='open';
else if(url.pathname.endsWith('/rpc/send_private_message')){const args=req.postDataJSON(),fail=privateFailure;privateFailure='';privateAttempts.push(args.p_client_id);if(fail==='before'){await route.fulfill({status:503,json:{message:'Connection interrupted'}});return;}let m=privateMessages.find(m=>m.client_id===args.p_client_id);if(!m){m={id:crypto.randomUUID(),client_id:args.p_client_id,author_id:uid,body:args.p_body,created_at:new Date().toISOString()};privateMessages.push(m);}data=m.id;if(fail==='after'){await route.fulfill({status:503,json:{message:'Response lost'}});return;}}
else if(url.pathname.endsWith('/rpc/close_private_chat')){privateChats[0].state='closed';privateMessages.splice(0);}
else if(url.pathname.endsWith('/music_saved_queues')||url.pathname.endsWith('/music_reactions'))data=[];
else if(url.pathname.endsWith('/member_blocks')||url.pathname.endsWith('/member_reports'))data=[];
else if(url.pathname.endsWith('/rpc/blocked_accounts'))data=blockedAccounts;
else if(url.pathname.endsWith('/rpc/set_member_block')){if(unblockFailure){unblockFailure=false;await route.fulfill({status:503,json:{message:'Network interruption'}});return;}const args=req.postDataJSON();if(args.p_blocked===false){const i=blockedAccounts.findIndex(a=>a.user_id===args.p_member_id);if(i>=0)blockedAccounts.splice(i,1);}}
  else if(url.pathname.endsWith('/rpc/group_update_authors'))data=[...new Set(content.filter(c=>c.state==='live'&&['post','reel','story'].includes(c.kind)).map(c=>c.author_id))].map(author_id=>({author_id,unread:content.some(c=>c.author_id===author_id&&c.state==='live'&&!seenContent.has(c.id))}));
  else if(url.pathname.endsWith('/rpc/mark_content_seen'))seenContent.add(req.postDataJSON().p_content_id);
  else if(url.pathname.endsWith('/group_content')){
   data=content.filter(c=>c.state==='live');const params=url.searchParams,author=params.get('author_id'),kind=params.get('kind'),ids=params.get('id');
   if(author)data=data.filter(c=>c.author_id===author.slice(3));
   if(kind?.startsWith('in.'))data=data.filter(c=>kind.slice(4,-1).split(',').includes(c.kind));
   else if(kind?.startsWith('eq.'))data=data.filter(c=>c.kind===kind.slice(3));
   if(params.get('object_path'))data=data.filter(c=>c.object_path);
   if(ids?.startsWith('in.'))data=data.filter(c=>ids.slice(4,-1).split(',').includes(c.id));
   for(const condition of params.getAll('or')){const cursor=/created_at.lt.([^,]+),and\(created_at.eq.[^,]+,id.lt.([^\)]+)/.exec(condition);if(cursor)data=data.filter(c=>c.created_at<cursor[1]||(c.created_at===cursor[1]&&c.id<cursor[2]));}
   data.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));if(params.get('limit'))data=data.slice(0,Number(params.get('limit')));
  }
 else if(url.pathname.endsWith('/rpc/reserve_media')){const a=req.postDataJSON();const c={id:crypto.randomUUID(),group_id:gid,author_id:uid,kind:a.p_kind,caption:a.p_caption,mime:null,object_path:null,state:'reserved',created_at:new Date().toISOString()};content.push(c);data=c;}
 else if(url.pathname.endsWith('/rpc/publish_media'))content[0].state='live';
 else if(url.pathname.endsWith('/board_tabs'))data=boardTabs;
else if(url.pathname.endsWith('/board_shapes')){data=boardShapes.filter(s=>!url.searchParams.has('id')||s.id===url.searchParams.get('id').slice(3));if(req.headers().accept?.includes('object'))data=data[0]||null;}
else if(url.pathname.endsWith('/rpc/create_board_tab')){const t={id:crypto.randomUUID(),name:req.postDataJSON().p_name};boardTabs.push(t);data=t.id;}
else if(url.pathname.endsWith('/rpc/write_board_shape')){const fail=boardFailure;boardFailure='';if(fail==='before'){await route.fulfill({status:503,json:{message:'Connection interrupted'}});return;}const a=req.postDataJSON();const shape={id:a.p_shape_id,updated_by:uid,tab_id:a.p_tab_id,data:a.p_data,deleted:a.p_deleted,revision:a.p_revision+1};const i=boardShapes.findIndex(s=>s.id===shape.id);if(i<0)boardShapes.push(shape);else boardShapes[i]=shape;data=shape.revision;if(fail==='after'){await route.fulfill({status:503,json:{message:'Response lost'}});return;}}
else if(url.pathname.endsWith('/ai_jobs'))data=aiJobs;
else if(url.pathname.endsWith('/rpc/group_weekly_topics'))data={week_start:'2026-09-14',partial:true,topics:[{label:'Planning our study session',sources:[crypto.randomUUID(),crypto.randomUUID()]}]};
else if(url.pathname.endsWith('/rpc/set_group_ai'))groups[0].ai_enabled=req.postDataJSON().p_enabled;
else if(url.pathname.endsWith('/functions/v1/group-ai')){const j={id:crypto.randomUUID(),kind:'summary',state:'done',result:'Mocked summary for UI verification.',sources:[],partial:false,created_at:new Date().toISOString()};aiJobs.push(j);data={jobId:j.id};}
else if(url.pathname.endsWith('/kick_votes'))data=votes;
  else if(url.pathname.endsWith('/vote_ballots'))data=[];
  else if(url.pathname.endsWith('/group_bans'))data=bans;
  else if(url.pathname.endsWith('/group_messages')){data=[...messages].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));const params=url.searchParams,ids=params.get('id');if(ids?.startsWith('in.'))data=data.filter(m=>ids.slice(4,-1).split(',').includes(m.id));if(params.get('deleted_at')==='not.is.null')data=data.filter(m=>m.deleted_at);const cursor=/created_at.lt.([^,]+),and\(created_at.eq.[^,]+,id.lt.([^\)]+)/.exec(params.get('or')||'');if(cursor)data=data.filter(m=>m.created_at<cursor[1]||(m.created_at===cursor[1]&&m.id<cursor[2]));if(params.get('limit'))data=data.slice(0,Number(params.get('limit')));}
  else if(url.pathname.endsWith('/rpc/delete_group_message')){const m=messages.find(m=>m.id===req.postDataJSON().p_message_id);m.body='Message deleted';m.deleted_at=new Date().toISOString();}
  else if(url.pathname.endsWith('/rpc/group_activity'))data={timezone:'Asia/Kuala_Lumpur',week_start:'2026-09-21',streak:1,today:{date:'2026-09-23',eligible:2,responded:2,required:2},rankings:[{author_id:uid,name:'Alice',total:4,weekly:2}],words:[{word:'friends',count:3}]};
else if(url.pathname.endsWith('/rpc/create_group')){const args=req.postDataJSON();groups.push({id:gid,name:args.p_name,description:args.p_description,timezone:args.p_timezone});data=gid;}
  else if(url.pathname.endsWith('/rpc/send_group_message')){const args=req.postDataJSON(),fail=messageFailure;messageFailure='';sendAttempts.push(args.p_client_id);if(fail==='before'){await route.fulfill({status:503,json:{message:'Message connection interrupted'}});return;}let row=messages.find(m=>m.client_id===args.p_client_id);if(!row){row={id:crypto.randomUUID(),author_id:uid,body:args.p_body,created_at:new Date().toISOString(),client_id:args.p_client_id};messages.push(row);}data=row.id;if(fail==='after'){await route.fulfill({status:503,json:{message:'Message acknowledgement lost'}});return;}}
  else if(url.pathname.endsWith('/rpc/create_invite'))data={invite_id:crypto.randomUUID(),token:'a'.repeat(64)};
  else if(url.pathname.endsWith('/rpc/start_kick_vote')){const vote={id:crypto.randomUUID(),target_id:bob.id,target_name:'Bob',target_role:'member',status:'open',threshold:1,eligible_count:1,kick_count:0,keep_count:0,expires_at:new Date(Date.now()+86400000).toISOString()};votes.push(vote);data=vote.id;}
  else if(url.pathname.endsWith('/rpc/cast_kick_vote')){votes[0].kick_count=1;votes[0].status='passed';bobRemoved=true;bans.push({user_id:bob.id,removed_role:'member',display_name:'Bob'});}
  else if(url.pathname.endsWith('/rpc/allow_reentry'))bans.splice(0);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });

 groups.push({id:gid,name:'The common room',description:'Study breaks, weekend plans & everything between.',timezone:'Asia/Kuala_Lumpur'});
 messages.push(...['Friday deserves a better soundtrack. What are we putting on?','I’m bringing the playlist. You bring the snacks.','Deal. Meet in the voice room after class?'].map((body,i)=>({id:crypto.randomUUID(),author_id:i===1?uid:bob.id,body,created_at:new Date(Date.now()-60000*(3-i)).toISOString()})));
 const photo=await readFile('public/images/photo-1476514525535-07fb3b4ae5f1.jpg');
 await page.route('**/storage/v1/object/group-media/**',route=>route.fulfill({status:200,contentType:'image/jpeg',body:photo}));
 content.push(...[{kind:'story',caption:'A little escape before the next deadline.',object_path:'fixture/lake',mime:'image/jpeg',author_id:bob.id},{kind:'story',caption:'Same time tomorrow?',object_path:'fixture/lake2',mime:'image/jpeg',author_id:uid},{kind:'post',caption:'The best part of the week: absolutely no plans.',object_path:null,mime:null,author_id:bob.id}].map((c,i)=>({...c,id:crypto.randomUUID(),group_id:gid,state:'live',created_at:new Date(Date.now()-60000*(i+1)).toISOString()})));
 groups.push({id:'55555555-5555-4555-8555-555555555555',name:'Another room',description:'Switching regression',timezone:'Asia/Kuala_Lumpur'});
 await page.goto('http://127.0.0.1:5176/groups');
 await expect(page.getByRole('heading',{name:'The common room',exact:true})).toBeVisible();
 for(let i=0;i<4;i++){
  await page.getByRole('navigation',{name:'Your groups'}).getByRole('button',{name:/Another room/}).click();
  await expect(page.getByRole('group',{name:'Group tools'}).getByRole('button',{name:'Activity',exact:true})).toHaveCount(1);
  await page.getByRole('navigation',{name:'Your groups'}).getByRole('button',{name:/The common room/}).click();
  await expect(page.getByRole('group',{name:'Group tools'}).getByRole('button',{name:'Activity',exact:true})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Room style',exact:true})).toHaveCount(1);
 }
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:width===390?844:900});
  await page.getByRole('button',{name:'Chat',exact:true}).click();
  await expect(page.getByText('Deal. Meet in the voice room after class?',{exact:true})).toBeVisible();
  await page.screenshot({path:`docs/design/clubhouse-chat-${width}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'Room style',exact:true}).click();
  await page.getByRole('button',{name:'Confetti wallpaper',exact:true}).click();
  await expect(page.locator('.main-area')).toHaveAttribute('data-wallpaper','confetti');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Stories',exact:true}).click();
  await expect(page.locator('.sharing-thumbnail img').first()).toBeVisible();
  await expect.poll(()=>page.locator('.sharing-thumbnail img').first().evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await page.screenshot({path:`docs/design/clubhouse-stories-${width}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'Stories only',exact:true}).click();
  await expect(page.locator('.sharing-grid article')).toHaveCount(2);
  await page.getByRole('button',{name:'Posts only',exact:true}).click();
  await page.getByRole('button',{name:'Open Bob story',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stories only',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Next moment',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Shared memory'})).toContainText('Same time tomorrow?');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('dialog',{name:'Shared memory'})).toContainText('A little escape');
  await page.getByRole('button',{name:'Close memory',exact:true}).click();
  await page.getByRole('button',{name:'All moments',exact:true}).click();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Stories overflow');
  await page.getByRole('button',{name:'Chat',exact:true}).click();
  await page.getByRole('button',{name:/Music box/}).click();
  await expect(page.locator('.room-record')).toBeVisible();
  await page.screenshot({path:`docs/design/clubhouse-music-${width}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'Close music box',exact:true}).click();
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:/Music box/}).click();
 await expect(page.locator('.room-record')).toHaveCSS('animation-name','none');
 await page.keyboard.press('Escape');
 await page.reload();
 await expect(page.locator('.main-area')).toHaveAttribute('data-wallpaper','confetti');
 console.log('PASS: eight group switches preserve one Activity/Room style control; Clubhouse wallpapers persist; Stories filters and manual/keyboard navigation; desktop/mobile screenshots, overflow and reduced-motion record. Synthetic group/media fixtures only.');
} finally {await browser.close();await server.close();}
