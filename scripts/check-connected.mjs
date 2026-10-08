import { createServer } from 'vite';
import { chromium, firefox, webkit, expect } from '@playwright/test';
const browserName=process.env.TEST_BROWSER||'chromium';
const browserType={chromium,firefox,webkit}[browserName];
if(!browserType)throw new Error('TEST_BROWSER must be chromium, firefox or webkit');
process.env.VITE_SUPABASE_URL='https://chatter-test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY='public-test-key';
const server=await createServer({server:{host:'127.0.0.1',port:5174,strictPort:true}});
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
 await page.goto('http://127.0.0.1:5174/groups');
 await expect(page.getByRole('heading',{name:'Good conversations start here.'})).toBeVisible();
 await page.locator('.connected-empty').getByRole('button',{name:'Create a group',exact:true}).click();
 await page.getByLabel('Group name',{exact:true}).fill('Connected corner');
 await page.getByLabel('Description',{exact:true}).fill('A real account interface');
 await page.getByRole('dialog').getByRole('button',{name:'Create group',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Connected corner',exact:true})).toBeVisible();
 if(process.env.TEST_NOTIFICATIONS){
  await page.getByRole('button',{name:'AI',exact:true}).click();
  await page.evaluate(async({gid,bob})=>{const {supabase}=await import('/src/lib/supabase.ts');const channel=supabase.getChannels().find(c=>c.topic.includes('group-sounds:'));if(!channel)throw Error('Missing notification subscription');const event={new:{id:'notice-test',group_id:gid,author_id:bob,body:'Realtime banner test',created_at:new Date().toISOString(),deleted_at:null}};channel.bindings.postgres_changes[0].callback(event);channel.bindings.postgres_changes[0].callback(event);},{gid,bob:bob.id});
  await expect(page.locator('.message-notification')).toHaveCount(1);await expect(page.getByText('Realtime banner test',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Open Connected corner chat'}).click();await expect(page.getByRole('textbox',{name:'Message your group',exact:true})).toBeVisible();await expect(page.locator('.message-notification')).toHaveCount(0);
  console.log('PASS: connected realtime handler displays one banner for duplicate delivery and opens Chat.');
 }
 await page.getByRole('textbox',{name:'Message your group',exact:true}).fill('A persisted message');
 messageFailure='before';await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByText('Message connection interrupted',{exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'Message your group',exact:true})).toHaveValue('A persisted message');
 messageFailure='after';await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByText('Message acknowledgement lost',{exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'Message your group',exact:true})).toHaveValue('A persisted message');
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByText('A persisted message',{exact:true})).toBeVisible();
 if(messages.length!==1||new Set(sendAttempts).size!==1||sendAttempts.length!==3)throw Error('Message retry changed its idempotency key or duplicated the send');
 await page.getByRole('button',{name:'Delete message',exact:true}).click();
 await page.getByRole('button',{name:'Keep message',exact:true}).click();
 await expect(page.getByText('A persisted message',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Delete message',exact:true}).click();
 await page.getByRole('button',{name:'Delete for everyone',exact:true}).click();
 await expect(page.getByText('A persisted message',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Message deleted',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Activity',exact:true}).click();
 await expect(page.getByText('Planning our study session',{exact:true})).toBeVisible();
 await expect(page.getByText('2 supporting messages',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'1 day together'})).toBeVisible();
 await page.getByRole('button',{name:'All time',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Group activity'})).toContainText('4 messages');
 await page.getByRole('button',{name:'Close activity'}).click();
 await page.getByRole('button',{name:'Room style',exact:true}).click();
 await page.getByRole('button',{name:'Confetti wallpaper',exact:true}).click();
 await expect(page.locator('.main-area')).toHaveAttribute('data-wallpaper','confetti');
 await page.getByRole('button',{name:'Pointer response',exact:true}).click();
 await expect(page.locator('.main-area')).toHaveAttribute('data-room-motion','off');
 await page.keyboard.press('Escape');
 await page.reload();
 await expect(page.locator('.main-area')).toHaveAttribute('data-wallpaper','confetti');
 await page.getByRole('button',{name:'Stories',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Story filters'})).toBeVisible();
 await page.getByRole('button',{name:'Stories only',exact:true}).click();
 await expect(page.locator('.sharing-grid article')).toHaveCount(0);
 await page.getByRole('button',{name:'All moments',exact:true}).click();
 await page.getByRole('button',{name:'New update',exact:true}).click();
 await page.getByLabel('Caption',{exact:true}).fill('A real group update');
 await page.getByRole('button',{name:'Share with group',exact:true}).click();
 await expect(page.getByText('A real group update',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Chat',exact:true}).click();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.getByRole('button',{name:'View Alice updates, unread updates',exact:true}).click();
 await expect(page.getByRole('button',{name:'Show everyone’s updates',exact:true})).toBeVisible();
 await page.locator('.sharing-open').filter({hasText:'A real group update'}).click();await page.getByRole('button',{name:'Close memory',exact:true}).click();
 await page.getByRole('button',{name:'Chat',exact:true}).click();await expect(page.getByRole('button',{name:'View Alice updates',exact:true})).toBeVisible();
 for(let i=0;i<105;i++)content.push({id:crypto.randomUUID(),group_id:gid,author_id:bob.id,kind:'post',caption:'History item '+i,mime:null,object_path:null,state:'live',created_at:new Date(Date.now()-60000*(i+1)).toISOString()});
 await page.getByRole('button',{name:'Stories',exact:true}).click();await expect(page.locator('.sharing-grid article')).toHaveCount(40);
 await page.getByRole('button',{name:'Load older memories',exact:true}).click();await expect(page.locator('.sharing-grid article')).toHaveCount(80);
 await page.getByRole('button',{name:'Load older memories',exact:true}).click();await expect(page.locator('.sharing-grid article')).toHaveCount(106);
 await expect(page.getByRole('button',{name:'Load older memories',exact:true})).toHaveCount(0);
 content.find(c=>c.caption==='History item 90').state='deleted';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByText('History item 90',{exact:true})).toHaveCount(0);await expect(page.getByText('History item 104',{exact:true})).toBeVisible();

 for(let i=0;i<45;i++)content.push({id:crypto.randomUUID(),group_id:gid,author_id:bob.id,kind:'post',caption:'Reconnect update '+i,mime:null,object_path:null,state:'live',created_at:new Date(Date.now()+1000*(i+1)).toISOString()});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByText('Reconnect update 44',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Load older memories',exact:true})).toBeVisible();await page.getByRole('button',{name:'Load older memories',exact:true}).click();await expect(page.getByText('Reconnect update 0',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Chat',exact:true}).click();
 for(let i=0;i<55;i++)messages.push({id:crypto.randomUUID(),author_id:bob.id,body:'Reconnect message '+i,created_at:new Date(Date.now()+1000*(i+1)).toISOString()});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByText('Reconnect message 54',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Load earlier messages',exact:true})).toBeVisible();overlapHistoryRefresh=true;await page.getByRole('button',{name:'Load earlier messages',exact:true}).click();await expect(page.getByText('Reconnect message 0',{exact:true})).toBeVisible();await expect(page.getByText('Message deleted',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Board',exact:true}).click();
 await page.getByRole('button',{name:'Create first tab',exact:true}).click();
 await page.getByLabel('Tab name',{exact:true}).fill('Group ideas');
 await page.getByRole('button',{name:'Save tab',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Group ideas'})).toBeVisible();
 const canvas=page.getByLabel('Collaborative drawing canvas');const box=await canvas.boundingBox();
 await page.mouse.move(box.x+50,box.y+50);await page.mouse.down();await page.mouse.move(box.x+120,box.y+90,{steps:5});await page.mouse.up();
 await expect(canvas.locator('polyline')).toHaveCount(1);
 await page.getByRole('button',{name:'Undo my last edit'}).click();await expect(canvas.locator('polyline')).toHaveCount(0);
 await page.getByRole('button',{name:'Redo my edit'}).click();await expect(canvas.locator('polyline')).toHaveCount(1);
 boardFailure='after';await page.getByRole('button',{name:'Undo my last edit'}).click();await expect(page.getByRole('button',{name:'Retry board save',exact:true})).toBeVisible();await page.getByRole('button',{name:'Retry board save',exact:true}).click();await expect(page.getByText('Saved to your group',{exact:true})).toBeVisible();await expect(canvas.locator('polyline')).toHaveCount(0);
 boardFailure='before';await page.getByRole('button',{name:'Redo my edit'}).click();await expect(page.getByRole('button',{name:'Retry board save',exact:true})).toBeVisible();await page.getByRole('button',{name:'Retry board save',exact:true}).click();await expect(page.getByText('Saved to your group',{exact:true})).toBeVisible();await expect(canvas.locator('polyline')).toHaveCount(1);
 for(const fail of ['before','after']){
  boardFailure=fail;const count=boardShapes.length;
  await page.mouse.move(box.x+80,box.y+130);await page.mouse.down();await page.mouse.move(box.x+150,box.y+160,{steps:3});await page.mouse.up();
  await expect(page.getByRole('button',{name:'Retry board save',exact:true})).toBeVisible();
  await expect(page.getByText('Unsaved edit',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Retry board save',exact:true}).click();
  await expect(page.getByText('Saved to your group',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Retry board save',exact:true})).toHaveCount(0);
  if(boardShapes.length!==count+1)throw Error('Retry duplicated or lost a drawing');
  await page.getByRole('button',{name:'Undo my last edit'}).click();await expect(canvas.locator('polyline')).toHaveCount(1);
 }
 await page.getByRole('button',{name:'Text',exact:true}).click();await canvas.click({position:{x:160,y:150}});
 await page.getByRole('textbox',{name:'Text',exact:true}).fill('Our plan');await page.getByRole('button',{name:'Save text'}).click();
 await expect(canvas.getByText('Our plan')).toBeVisible();
 await page.getByRole('button',{name:'Undo my last edit',exact:true}).click();await expect(canvas.getByText('Our plan')).toHaveCount(0);await page.getByRole('button',{name:'Redo my edit',exact:true}).click();await expect(canvas.getByText('Our plan')).toBeVisible();
 boardTabs.push({id:crypto.randomUUID(),name:'Another member’s tab'});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('tab',{name:'Another member’s tab',exact:true})).toBeVisible();
 await page.screenshot({path:'docs/design/board-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/design/board-mobile.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Board page overflow');
 await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Chat',exact:true}).click();
 await page.getByRole('button',{name:'AI',exact:true}).click();
 await page.getByRole('button',{name:'Enable group AI',exact:true}).click();
 await page.getByRole('dialog',{name:'Enable group AI'}).getByRole('button',{name:'Enable group AI',exact:true}).click();
 await page.getByLabel('Conversation range',{exact:true}).selectOption('custom');await page.getByLabel('From date',{exact:true}).fill('2026-09-20');await page.getByLabel('Through date',{exact:true}).fill('2026-09-01');await page.getByRole('button',{name:'Catch me up',exact:true}).click();await expect(page.getByText('Choose a valid conversation range of up to 31 days.',{exact:true})).toBeVisible();
 await page.getByLabel('Conversation range',{exact:true}).selectOption('1');
 await page.getByRole('button',{name:'Catch me up',exact:true}).click();
 await expect(page.getByText('Mocked summary for UI verification.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Chat',exact:true}).click();
 // Opening a tool must not reduce the conversation's available height.
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:844});
  const before=await page.locator('.live-messages').boundingBox();
  await page.getByRole('button',{name:/Music box/}).click();
  await expect(page.getByRole('region',{name:'Music box',exact:true})).toBeVisible();
  const after=await page.locator('.live-messages').boundingBox();
  if(Math.abs(before.height-after.height)>1)throw Error('Opening music squeezed chat');
  const rail=await page.locator('.room-tools').boundingBox();
  if(rail.height>65)throw Error('Group tools no longer fit one compact row');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Tool rail overflow');
  await page.screenshot({path:`docs/design/chat-tools-${width}.png`,animations:'disabled'});
  await page.keyboard.press('Escape');
  await expect(page.locator('.music-body')).toHaveCount(0);
  await page.getByRole('button',{name:/Voice room/}).click();
  await expect(page.getByRole('region',{name:'Voice room',exact:true})).toBeVisible();
  const voiceHeight=(await page.locator('.live-messages').boundingBox()).height;
  if(Math.abs(before.height-voiceHeight)>1)throw Error('Opening voice squeezed chat');
  await page.getByRole('button',{name:'Close voice room',exact:true}).click();
  await expect(page.locator('.voice-body')).toHaveCount(0);
  await page.screenshot({path:`docs/design/chat-space-${width}.png`,animations:'disabled'});
 }
 await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:/Music box/}).click();
 await page.getByRole('button',{name:'Join listening',exact:true}).click();
 await page.getByLabel('Song or playlist link',{exact:true}).fill('https://youtu.be/dQw4w9WgXcQ');await page.getByRole('button',{name:'Check link',exact:true}).click();
 await page.getByLabel('Queue label',{exact:true}).fill('Our test track');await page.getByRole('button',{name:'Add to this group’s queue',exact:true}).click();
 await page.getByRole('button',{name:'Play for group',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__musicPlayed)).toBe(true);
 await page.evaluate(()=>window.__keptPlayer=window.__video);await page.getByRole('button',{name:'Close music box',exact:true}).click();await expect(page.locator('.music-body')).toHaveCount(0);await expect(page.getByRole('region',{name:'Listening session'})).toBeVisible();if(music.listeners.length!==1||!await page.evaluate(()=>window.__keptPlayer===window.__video))throw Error('Minimizing left or remounted player');await page.getByRole('button',{name:/Music box/}).click();
 await page.getByLabel('Song description',{exact:true}).fill('The Daft Punk song with Pharrell');await page.getByRole('button',{name:'Find matches',exact:true}).click();
 await expect(page.getByRole('button',{name:'Add Get Lucky by Daft Punk',exact:true})).toBeVisible();if(music.queue.length!==1)throw Error('Search queued a track without selection');
 await page.getByRole('button',{name:'Add Get Lucky by Daft Punk',exact:true}).click();await expect(page.locator('.music-queue')).toContainText('Get Lucky');if(music.queue.length!==2)throw Error('Chosen match was not queued');
 music.session.host_id=bob.id;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('button',{name:'Pause for group',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{window.__video.state=0;window.__video.options.events.onStateChange?.({data:0});});await page.waitForTimeout(3200);if(nextAttempts!==0||music.queue.length!==2)throw Error('Listener ending advanced the queue');
 nextFailure=true;music.session.host_id=uid;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('button',{name:'Retry next track',exact:true})).toBeVisible();await page.waitForTimeout(3200);if(nextAttempts!==1)throw Error('Failed completion retried automatically');
 await page.getByRole('button',{name:'Retry next track',exact:true}).click();await page.getByRole('button',{name:/Music box/}).click();await expect(page.locator('iframe[title="apple track"]')).toHaveAttribute('src','https://embed.music.apple.com/my/album/617154241?i=617154366');
 await page.screenshot({path:'docs/design/music-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/design/music-mobile.png'});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Music mobile overflow');await page.setViewportSize({width:1280,height:900});
 for(const [width,label] of [[1280,'desktop'],[390,'mobile']]){await page.setViewportSize({width,height:900});await page.locator('.music-body').evaluate(el=>{const search=el.querySelector('.song-search');el.scrollTop+=search.getBoundingClientRect().top-el.getBoundingClientRect().top-16;});await page.screenshot({path:'docs/design/song-search-'+label+'.png'});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Song search overflow');}await page.setViewportSize({width:1280,height:900});
 await page.getByLabel('Song or playlist link',{exact:true}).fill('https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof');await page.getByRole('button',{name:'Check link',exact:true}).click();await page.getByLabel('Queue label',{exact:true}).fill('Spotify check');await page.getByRole('button',{name:'Add to this group’s queue',exact:true}).click();await page.getByRole('button',{name:'Next item',exact:true}).click();
 await expect(page.getByRole('link',{name:'Open on Spotify',exact:true})).toHaveAttribute('href','https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof');
 await expect(page.locator('.music-body iframe[src*="spotify"]')).toHaveCount(0);await expect(page.getByRole('button',{name:'Play for group',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Pause for group',exact:true})).toHaveCount(0);await expect(page.getByText('Spotify playback opens in Spotify. Your group shares the queue and skip votes; playback is individual.',{exact:true})).toBeVisible();
 await page.getByLabel('Song or playlist link',{exact:true}).fill('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');await page.getByRole('button',{name:'Check link',exact:true}).click();await page.getByRole('button',{name:'Add to this group’s queue',exact:true}).click();await page.getByRole('button',{name:'Next item',exact:true}).click();
 await expect(page.getByRole('link',{name:'Open on Spotify',exact:true})).toHaveAttribute('href','https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');await expect(page.locator('.music-body iframe[src*="spotify"]')).toHaveCount(0);if(await page.evaluate(()=>!!window.__spotify))throw Error('Spotify player loaded despite external-only mode');
 await page.getByLabel('Song or playlist link',{exact:true}).fill('https://www.youtube.com/playlist?list=PLUl4u3cNGP63EdVPNLG3ToM6LaEUuStEY');await page.getByRole('button',{name:'Check link',exact:true}).click();await page.getByRole('button',{name:'Add to this group’s queue',exact:true}).click();await page.getByRole('button',{name:'Next item',exact:true}).click();
 await expect(page.getByRole('button',{name:'Play for group',exact:true})).toBeVisible();await expect.poll(()=>music.session.playlist_video_id).toBe('M7lc1UVf-VE');playlistFailure=true;const beforeFailure=playlistAttempts;await page.getByRole('button',{name:'Next playlist track',exact:true}).click();await expect(page.getByRole('button',{name:'Retry playlist sync',exact:true})).toBeVisible();await page.waitForTimeout(1600);if(playlistAttempts!==beforeFailure+1)throw Error('Failed playlist change retried in a loop');await page.getByRole('button',{name:'Retry playlist sync',exact:true}).click();await page.getByRole('button',{name:'Next playlist track',exact:true}).click();await expect.poll(()=>music.session.playlist_video_id).toBe('dQw4w9WgXcQ');
 music.session.host_id=bob.id;music.session.revision++;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('button',{name:'Next playlist track',exact:true})).toHaveCount(0);const followerAttempts=playlistAttempts;await page.evaluate(()=>window.__playlist.playVideoAt(0));await expect.poll(()=>page.evaluate(()=>window.__playlist.getPlaylistIndex())).toBe(1);if(playlistAttempts!==followerAttempts)throw Error('Follower published a native playlist change');
 await page.evaluate(()=>{window.__playlist.state=-1;window.__playlist.options.events.onError({data:100});});await page.waitForTimeout(1600);await expect(page.getByText('YouTube cannot play this track here. Ask the host to choose another track.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Retry playlist playback',exact:true}).click();await expect(page.getByText('YouTube cannot play this track here. Ask the host to choose another track.',{exact:true})).toHaveCount(0);
 music.session.host_id=uid;music.session.revision++;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('button',{name:'Previous playlist track',exact:true})).toBeVisible();await page.getByRole('button',{name:/Music box/}).click();await page.getByRole('button',{name:'Play for group',exact:true}).click();await page.evaluate(()=>{const p=window.__playlist,play=p.playVideo.bind(p);p.playCalls=0;p.playVideo=()=>{p.playCalls++;play();};p.state=2;p.options.events.onAutoplayBlocked();});await page.waitForTimeout(1600);await expect(page.getByText('Press Enable playlist audio to allow playback on this device.',{exact:true})).toBeVisible();if(await page.evaluate(()=>window.__playlist.playCalls)!==0)throw Error('Autoplay blocked player retried without a gesture');await page.getByRole('button',{name:'Enable playlist audio',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__playlist.getPlayerState())).toBe(1);await page.evaluate(()=>{window.__playlist.state=0;window.__playlist.options.events.onStateChange({data:0});});await expect.poll(()=>music.queue.length).toBe(0);

 await page.getByRole('button',{name:/Music box/}).click();await page.getByRole('button',{name:'Leave listening',exact:true}).click();await expect(page.getByRole('button',{name:'Join listening',exact:true})).toBeVisible();await page.getByRole('button',{name:/Music box/}).click();
 await page.getByRole('button',{name:'New invite link'}).click();
 await expect(page.getByLabel('Invitation link')).toHaveValue(new RegExp('/join/a{64}$'));
 await expect(page.locator('.invite-qr svg')).toBeVisible();
 await page.getByRole('button',{name:'Revoke',exact:true}).click();
 await expect(page.getByLabel('Invitation link')).toHaveCount(0);
 await page.getByRole('button',{name:'Private chats',exact:true}).click();
await page.getByRole('button',{name:'Request chat with Bob'}).click();
await expect(page.getByText('Waiting for acceptance')).toBeVisible();
privateChats[0].requester_id=bob.id;privateChats[0].recipient_id=uid;
await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
await page.getByRole('button',{name:'Accept',exact:true}).click();
await page.getByRole('textbox',{name:'Private message',exact:true}).fill('Temporary secret');
privateFailure='before';await page.getByRole('button',{name:'Send private message',exact:true}).click();await expect(page.getByRole('textbox',{name:'Private message',exact:true})).toBeEnabled();await expect(page.getByRole('textbox',{name:'Private message',exact:true})).toHaveValue('Temporary secret');
privateFailure='after';await page.getByRole('button',{name:'Send private message',exact:true}).click();await expect(page.getByRole('textbox',{name:'Private message',exact:true})).toBeEnabled();await expect(page.getByRole('textbox',{name:'Private message',exact:true})).toHaveValue('Temporary secret');
await page.getByRole('button',{name:'Send private message',exact:true}).click();
await expect(page.getByText('Temporary secret',{exact:true})).toBeVisible();
if(privateMessages.length!==1||new Set(privateAttempts).size!==1||privateAttempts.length!==3)throw Error('Private message recovery lost its retry identity');
for(let i=0;i<105;i++)privateMessages.push({id:crypto.randomUUID(),author_id:bob.id,body:'Older private '+i,created_at:new Date(Date.now()-60000*(i+1)).toISOString()});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
await page.getByRole('button',{name:'Load earlier private messages',exact:true}).click();await expect(page.getByText('Older private 104',{exact:true})).toBeVisible();
await page.screenshot({path:'docs/design/private-chat-desktop.png'});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'docs/design/private-chat-mobile.png'});
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Private chat mobile overflow');
await page.getByRole('button',{name:'End conversation',exact:true}).click();
await page.getByRole('button',{name:'End and delete',exact:true}).click();
await expect(page.getByText('This conversation has ended.',{exact:true})).toBeVisible();
await expect(page.getByText('Temporary secret',{exact:true})).toHaveCount(0);
await page.getByRole('button',{name:'Close private chats panel'}).click();
await page.setViewportSize({width:1280,height:900});
await page.getByRole('button',{name:'Members',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Group controls'})).toBeVisible();
 await page.getByRole('button',{name:'Safety',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Personal blocks'})).toBeVisible();
 await page.getByRole('button',{name:'Block or report',exact:true}).click();
 await expect(page.getByRole('button',{name:'Block and delete private chats'})).toBeVisible();
 let reportFail=true;await page.route('**/rest/v1/rpc/report_member',async route=>{if(reportFail){reportFail=false;await route.fulfill({status:503,json:{message:'Synthetic report failure'}});}else await route.fulfill({json:crypto.randomUUID()});});
 await page.locator('.safety-form textarea').fill('Keep this report after a failed submission');await page.getByRole('button',{name:'Send report',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Unable to complete this action');await expect(page.locator('.safety-form textarea')).toHaveValue('Keep this report after a failed submission');
 await page.getByRole('button',{name:'Send report',exact:true}).click();await expect(page.getByText('Report sent to the owner.',{exact:true})).toBeVisible();await expect(page.locator('.safety-form textarea')).toHaveCount(0);await page.unroute('**/rest/v1/rpc/report_member');await page.getByRole('button',{name:'Block or report',exact:true}).click();

 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Delete this group',exact:true}).click();
 await expect(page.getByRole('button',{name:'Permanently delete group'})).toBeDisabled();
 await page.getByLabel('Group name to confirm deletion').fill('Connected corner');
 await expect(page.getByRole('button',{name:'Permanently delete group'})).toBeEnabled();
 await page.getByRole('button',{name:'Keep group'}).click();
 await page.getByRole('button',{name:'Members (2)',exact:true}).click();
 await page.screenshot({path:'docs/design/clubhouse-members.png',fullPage:true});
 await page.getByRole('button',{name:'Start kick / keep vote'}).click();
 await page.getByRole('button',{name:'Start vote',exact:true}).click();
 await page.getByRole('button',{name:'Votes',exact:true}).click();
 await expect(page.locator('.vote-card')).toContainText('Bob');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'docs/design/clubhouse-vote-mobile.png',fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Moderation mobile overflow');
 await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:'Kick',exact:true}).click();
 await expect(page.locator('.vote-status')).toHaveText('passed');
 await page.getByRole('button',{name:'Removed',exact:true}).click();
 await page.getByRole('button',{name:'Allow back',exact:true}).click();
 await page.getByRole('button',{name:'Allow re-entry',exact:true}).click();
 await expect(page.getByText('No members are blocked from returning.')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Appearance',exact:true}).click();
 const appearance=page.getByRole('dialog',{name:'Appearance',exact:true});
 await appearance.getByText('CSS editor',{exact:true}).click();
 await appearance.getByLabel('Theme CSS',{exact:true}).fill('.bubble { border-radius: 24px; } .board-tools button { border-radius: 23px; } .ai-actions button { border-radius: 23px; } .sharing-open { border-radius: 23px; }');
 await appearance.getByRole('button',{name:'Apply theme',exact:true}).click();
 await expect(appearance.getByText('Saved on this browser.',{exact:true})).toBeVisible();
 await expect(page.locator('.live-messages .bubble').first()).toHaveCSS('border-radius','24px');
 await appearance.getByRole('button',{name:'Done',exact:true}).click();
 for(const [view,selector] of [['Board','.board-tools button'],['AI','.ai-actions button'],['Stories','.sharing-open']]){await page.getByRole('button',{name:view,exact:true}).click();await expect(page.locator(selector).first()).toHaveCSS('border-radius','23px');}
 await page.getByRole('button',{name:'Chat',exact:true}).click();await page.getByRole('button',{name:'Appearance',exact:true}).click();await appearance.getByText('CSS editor',{exact:true}).click();
 await appearance.getByLabel('Theme CSS',{exact:true}).fill('body { color: #ffffff; }');
 await appearance.getByRole('button',{name:'Apply theme',exact:true}).click();
 await expect(appearance.getByRole('alert')).toContainText('supported theme selector');
 await appearance.getByRole('button',{name:'Reset',exact:true}).click();
 await appearance.getByText('Interactive code playground',{exact:true}).click();
 await appearance.getByRole('button',{name:'Run preview',exact:true}).click();
 await page.frameLocator('iframe[title="Isolated theme preview"]').getByRole('button',{name:'Try softer bubbles'}).click();
 await expect(appearance.getByText('Sandbox colors copied to preview. Apply to keep them.',{exact:true})).toBeVisible();
 await page.screenshot({path:'docs/design/appearance-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'docs/design/appearance-mobile.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Appearance mobile overflow');
 await appearance.getByRole('button',{name:'Done',exact:true}).click();
 await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:'Appearance',exact:true}).click();
 await appearance.getByText('Interactive code playground',{exact:true}).click();
 const uiCode=`<button onclick="parent.postMessage({type:'chatter-ui',version:1,css:'.bubble { border-radius: 12px; padding: 12px; }',action:'focus-composer'},'*')">Compact conversations</button><output></output><script>try{parent.document.body;document.querySelector('output').textContent='Parent exposed'}catch{document.querySelector('output').textContent='Parent blocked'}fetch('https://theme-escape.invalid/test').catch(()=>document.querySelector('output').textContent+='; network blocked');</script>`;
 await appearance.getByLabel('Sandbox code',{exact:true}).fill(uiCode);await appearance.getByLabel('Enable live UI controls after applying',{exact:true}).check();await appearance.getByRole('button',{name:'Apply theme',exact:true}).click();await appearance.getByRole('button',{name:'Done',exact:true}).click();
 const liveFrame=page.frameLocator('iframe[title="Your UI controls"]');await expect(liveFrame.locator('output')).toHaveText('Parent blocked; network blocked');
 await page.evaluate(()=>window.postMessage({type:'chatter-ui',version:1,css:'.bubble { border-radius: 1px; }'},'*'));await expect(page.locator('.live-messages .bubble').first()).not.toHaveCSS('border-radius','1px');
 await liveFrame.getByRole('button',{name:'Compact conversations',exact:true}).click();await expect(page.locator('.live-messages .bubble').first()).toHaveCSS('border-radius','12px');await expect(page.getByRole('textbox',{name:'Message your group',exact:true})).toBeFocused();
 await page.screenshot({path:'docs/design/theme-runtime-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/design/theme-runtime-mobile.png'});await expect(page.getByRole('button',{name:'Pause UI code',exact:true})).toBeVisible();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Live theme controls overflow');await page.setViewportSize({width:1280,height:900});
 await page.goto('http://127.0.0.1:5174/groups?safe-theme=1');await expect(page.getByRole('heading',{name:'Connected corner',exact:true})).toBeVisible();await expect(page.locator('iframe[title="Your UI controls"]')).toHaveCount(0);await expect(page.locator('.live-messages .bubble').first()).toHaveCSS('border-radius','16px');
 await page.goto('http://127.0.0.1:5174/groups');await expect(page.frameLocator('iframe[title="Your UI controls"]').getByRole('button',{name:'Compact conversations'})).toBeVisible();await expect(page.locator('.live-messages .bubble').first()).toHaveCSS('border-radius','12px');
 await page.getByRole('button',{name:'Pause UI code',exact:true}).click();await expect(page.locator('iframe[title="Your UI controls"]')).toHaveCount(0);
 await page.getByRole('button',{name:'Appearance',exact:true}).click();await appearance.getByText('CSS editor',{exact:true}).click();await appearance.getByLabel('Theme CSS',{exact:true}).fill('.bubble { border-radius: 20px; animation: chatter-theme-arrive 200ms ease; }');await appearance.getByRole('button',{name:'Apply theme',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.live-messages .bubble').first()).toHaveCSS('animation-name','none');await page.emulateMedia({reducedMotion:'no-preference'});await appearance.getByRole('button',{name:'Roll back',exact:true}).click();await expect(page.locator('.live-messages .bubble').first()).toHaveCSS('border-radius','12px');
 await appearance.locator('input[type=file]').setInputFiles({name:'custom-theme.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({theme:{accent:'#076371',background:'#ffffff',bubble:'#e3f2ef',text:'#243438',radius:16,fontSize:14},css:'',code:uiCode,enabled:true}))});await appearance.getByText('Interactive code playground',{exact:true}).click();await expect(appearance.getByLabel('Enable live UI controls after applying',{exact:true})).not.toBeChecked();await appearance.getByRole('button',{name:'Apply theme',exact:true}).click();await expect(page.locator('iframe[title="Your UI controls"]')).toHaveCount(0);await appearance.getByRole('button',{name:'Done',exact:true}).click();
 bobRemoved=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.getByRole('button',{name:'Group sounds',exact:true}).click();
 const sounds=page.getByRole('dialog',{name:'Group sounds',exact:true});
 await sounds.getByLabel('Sound for Bob',{exact:true}).selectOption('pop');
 await sounds.getByLabel('Mute this group',{exact:true}).check();
 await sounds.getByLabel('Import sound for Bob',{exact:true}).setInputFiles({name:'invalid.wav',mimeType:'audio/wav',buffer:Buffer.from('not audio')});
 await expect(sounds.getByRole('alert')).toBeVisible();
 const wav=Buffer.alloc(44+8000);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(8000,40);
 await sounds.getByLabel('Import sound for Bob',{exact:true}).setInputFiles({name:'short.wav',mimeType:'audio/wav',buffer:wav});
 const supportsAudio=await page.evaluate(()=>typeof AudioContext!=='undefined');
 if(supportsAudio){
 await expect(sounds.getByLabel('Sound for Bob',{exact:true})).toHaveValue('imported');
 await sounds.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(sounds.getByRole('alert')).toHaveCount(0);
 }else{await expect(sounds.getByRole('alert')).toHaveText('This browser does not support notification sounds. Try a browser with Web Audio support.');console.log('LIMITATION: this browser build has no Web Audio; verified the unsupported message, not sound import/playback.');}
 await sounds.getByLabel('Sound for Bob',{exact:true}).selectOption('pop');
 await sounds.getByRole('button',{name:'Done',exact:true}).click();
 await page.getByRole('button',{name:'Group sounds',exact:true}).click();
 await expect(sounds.getByLabel('Sound for Bob',{exact:true})).toHaveValue('pop');
 await expect(sounds.getByLabel('Mute this group',{exact:true})).toBeChecked();
 await sounds.getByRole('button',{name:'Done',exact:true}).click();
 await page.locator('.profile-control').click();
 await page.getByLabel('Profile photo',{exact:true}).setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAOUlEQVR4nO3RwQkAMAzDQBc6d7p6R1A+/ukGcEA5mZemW12PBxb8ATIRMhEyETIRMhEyETIRMlHIBwIIAXu5uNt2AAAAAElFTkSuQmCC','base64')});
 await expect(page.getByRole('button',{name:'Remove photo',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Remove photo',exact:true}).click();await expect(page.getByRole('button',{name:'Remove photo',exact:true})).toHaveCount(0);
 await page.getByLabel('Display name',{exact:true}).fill('Alice Updated');
 await page.getByRole('button',{name:'Save profile'}).click();
 await expect(page.locator('.profile-control')).toContainText('Alice Updated');
 await page.reload();
 await page.getByRole('button',{name:'Group sounds',exact:true}).click();
 await expect(page.getByLabel('Sound for Bob',{exact:true})).toHaveValue('pop');
 await expect(page.getByLabel('Mute this group',{exact:true})).toBeChecked();
 console.log('PASS: personalization CSS validation, sandbox bridge, mobile dialog, browser audio capability handling and persistent sender preferences.');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 const {checkComposerUI}=await import('./check-composer-ui.mjs');await checkComposerUI(page,expect);
 // An older empty group must not replace the selected group after refresh.
 groups.unshift({id:'55555555-5555-4555-8555-555555555555',name:'Older empty group',description:'',timezone:'UTC'});
 await page.locator('.tabs-row').getByRole('button',{name:'Stories',exact:true}).click();
 await page.reload();
 await expect(page.getByRole('heading',{name:'Connected corner',exact:true})).toBeVisible();
 await expect(page.locator('.tabs-row button.active')).toHaveText('Stories');
 await expect(page.getByText('Reconnect update 44',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Albums',exact:true}).click();
 await page.getByRole('navigation',{name:'Album folders'}).getByRole('button',{name:'Stories',exact:true}).click();
 await page.reload();
 await expect(page.locator('.tabs-row button.active')).toHaveText('Albums');
 await expect(page.getByRole('navigation',{name:'Album folders'}).locator('button.selected')).toHaveText('Stories');
 console.log('PASS: selected group, Stories tab, saved content and album folder survive reload with multiple groups.');
 groups.splice(0);await page.reload();await page.locator('.profile-control').click();
 const blocks=page.getByRole('region',{name:'Blocked accounts',exact:true});await expect(blocks.getByText('Former classmate',{exact:true})).toBeVisible();await blocks.getByRole('button',{name:'Unblock Former classmate',exact:true}).click();await blocks.getByRole('button',{name:'Keep blocked',exact:true}).click();if(blockedAccounts.length!==1)throw Error('Cancel removed a block');
 await blocks.getByRole('button',{name:'Unblock Former classmate',exact:true}).click();unblockFailure=true;await blocks.getByRole('button',{name:'Confirm unblock',exact:true}).click();await expect(blocks.getByRole('alert')).toBeVisible();if(blockedAccounts.length!==1)throw Error('Failed unblock removed its row');await blocks.getByRole('button',{name:'Confirm unblock',exact:true}).click();await expect(blocks.getByText('No blocked accounts.',{exact:true})).toBeVisible();
 console.log('PASS: blocked-account recovery with no groups, confirmation cancellation and failed-request retry.');
 console.log('PASS: mocked connected UI — session, groups, sends, QR/invite/revoke, member controls, vote/remove/re-entry flow, profile update. Not a live backend test.');
} finally {await browser.close();await server.close();}

