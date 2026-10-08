import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const keyResult=spawnSync('cmd.exe',['/d','/s','/c','npx supabase projects api-keys --project-ref ynnzfygliidbwgvpkxjl --output json --reveal'],{encoding:'utf8'});
if(keyResult.status!==0)throw Error('Unable to access administrative test credentials');
const keys=JSON.parse(keyResult.stdout),secret=keys.find(k=>k.name==='service_role')?.api_key;
if(!secret)throw Error('Administrative credential unavailable');
const url=process.env.VITE_SUPABASE_URL,publicKey=process.env.VITE_SUPABASE_ANON_KEY;
const admin=createClient(url,secret,{auth:{persistSession:false}}),clients=[],users=[],credentials=[];
let group,asset,avatarAsset,soundGroup;const extraAssets=[];
function check(r){if(r.error)throw Error(r.error.message);return r.data;}
try{
 for(let i=0;i<2;i++){const email='smoke-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+crypto.randomUUID();const user=check(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Smoke '+i}})).user;users.push(user.id);credentials.push({email,password});const c=createClient(url,publicKey,{auth:{persistSession:false}});check(await c.auth.signInWithPassword({email,password}));clients.push(c);}
 group=check(await clients[0].rpc('create_group',{p_name:'Temporary integration check',p_description:'Will be removed by test',p_timezone:'Asia/Kuala_Lumpur'}));
 const inv=check(await clients[0].rpc('create_invite',{p_group_id:group}));check(await clients[1].rpc('join_group',{p_token:inv.token}));
 if(process.env.TEST_WEEKLY_TOPICS==='1'){
  check(await clients[0].rpc('set_group_ai',{p_group_id:group,p_enabled:true}));
  const sourceId=crypto.randomUUID();check(await admin.from('group_messages').insert({id:sourceId,group_id:group,author_id:users[0],client_id:crypto.randomUUID(),body:'Our study group agreed to meet in the library on Friday to review calculus.',created_at:'2026-09-15T12:00:00Z'}));
  const job=check(await admin.from('ai_jobs').insert({group_id:group,kind:'weekly',week_start:'2026-09-14'}).select('id').single());
  const claimed=check(await admin.rpc('claim_ai_job',{p_job_id:job.id}));
  globalThis.Deno={env:{get:name=>process.env[name]}};
  const {performJob}=await import('../supabase/functions/_shared/ai.ts');await performJob(admin,claimed);
  const saved=check(await admin.from('ai_jobs').select('state,topics').eq('id',job.id).single());assert.equal(saved.state,'done','Real weekly provider must return valid structured output');assert.ok(saved.topics.length>0);
  const topicResult=check(await clients[1].rpc('group_weekly_topics',{p_group_id:group}));assert.ok(topicResult.topics.some(t=>t.sources.includes(sourceId)));
  check(await admin.from('group_messages').update({deleted_at:new Date().toISOString(),body:'[deleted]'}).eq('id',sourceId));assert.equal(check(await clients[0].rpc('group_weekly_topics',{p_group_id:group})).topics.length,0);
  console.log('PASS: real free OpenRouter weekly topics, hosted atomic completion, member reads and deleted-source exclusion. Worker called locally; scheduler timing not tested.');
 }
 const musicConnections=[crypto.randomUUID(),crypto.randomUUID()];const music=(i,action,payload={})=>clients[i].rpc('music_action',{p_group_id:group,p_action:action,p_payload:payload});
 check(await music(0,'join',{connection:musicConnections[0]}));check(await music(1,'join',{connection:musicConnections[1]}));
 let musicState=check(await music(0,'add',{provider:'youtube',kind:'track',external_id:'dQw4w9WgXcQ',title:'Test queue'}));assert.ok((await music(1,'play',{revision:musicState.session.revision})).error);
 musicState=check(await music(0,'play',{revision:musicState.session.revision}));assert.equal(musicState.session.playing,true);
 musicState=check(await music(0,'leave',{connection:musicConnections[0]}));assert.equal(musicState.session.host_id,users[1]);check(await music(1,'leave',{connection:musicConnections[1]}));
 console.log('PASS: deployed music queue, host authorization and succession.');
 if(process.env.TEST_LIVE_SONG==='1'){
  check(await clients[0].rpc('set_group_ai',{p_group_id:group,p_enabled:true}));const clientId=crypto.randomUUID(),body={groupId:group,clientId,query:'The Daft Punk song Get Lucky with Pharrell',country:'MY'};
  const result=check(await clients[0].functions.invoke('find-song',{body}));assert.equal(result.state,'done',result.error||'Live song search failed');assert.ok(result.matches.length>0);const match=result.matches[0];assert.equal(match.provider,'apple');assert.match(match.external_id,/^my:\d+:\d+$/);
  const again=check(await clients[0].functions.invoke('find-song',{body}));assert.equal(again.jobId,result.jobId);assert.deepEqual(again.matches,result.matches);
  assert.equal(check(await clients[0].rpc('music_state',{p_group_id:group})).queue.length,0,'Search must not start playback or queue anything');
  await music(0,'join',{connection:musicConnections[0]});const state=check(await music(0,'add',{...match,title:match.title+' — '+match.artist}));assert.equal(state.queue[0].external_id,match.external_id);check(await music(0,'leave',{connection:musicConnections[0]}));
  console.log('PASS: deployed find-song with real free OpenRouter and Apple catalog, cached retry and explicit matched-track queue addition. Full provider playback not tested.');
 }
 if(process.env.TEST_NOTIFICATIONS==='1'){soundGroup=check(await clients[0].rpc('create_group',{p_name:'Temporary sound check',p_description:'Will be removed by test',p_timezone:'UTC'}));const invitation=check(await clients[0].rpc('create_invite',{p_group_id:soundGroup}));check(await clients[1].rpc('join_group',{p_token:invitation.token}));}
 if(process.env.TEST_DEPLOYED_UI==='1'){
  const {chromium,expect}=await import('@playwright/test');const browser=await chromium.launch({args:process.env.TEST_LIVE_VOICE==='1'?['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']:process.env.TEST_LIVE_COMPOSER==='1'?['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']:[]});
  try{const pages=[];for(let i=0;i<2;i++){const context=await browser.newContext({permissions:['microphone'],viewport:i?{width:390,height:844}:{width:1280,height:900}}),page=await context.newPage();pages.push(page);await page.addInitScript(()=>{window.__pings=0;const Audio=window.AudioContext;window.AudioContext=class extends Audio{createOscillator(){window.__pings++;return super.createOscillator();}};window.__voiceStreams=[];window.__voicePeers=[];const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const stream=await gum(c);window.__voiceStreams.push(stream);return stream;};const Peer=window.RTCPeerConnection;window.RTCPeerConnection=class extends Peer{constructor(...args){super(...args);window.__voicePeers.push(this);}};});await page.goto((process.env.TEST_UI_ORIGIN||'https://apu-chatter.pages.dev')+'/login');await page.getByLabel('Email address',{exact:true}).fill(credentials[i].email);await page.locator('input[type=password]').fill(credentials[i].password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Temporary integration check',exact:true})).toBeVisible({timeout:20000});}
   await pages[0].getByRole('textbox',{name:'Message your group',exact:true}).fill('Deployed two-browser verification');await pages[0].getByRole('button',{name:'Send message',exact:true}).click();await expect(pages[1].getByText('Deployed two-browser verification',{exact:true})).toBeVisible({timeout:20000});
   if(await pages[1].evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Deployed mobile overflow');
   await pages[0].locator('.profile-control').click();await pages[0].getByLabel('Profile photo',{exact:true}).setInputFiles('scripts/fixtures/avatar.png');await expect(pages[0].getByRole('button',{name:'Remove photo',exact:true})).toBeVisible({timeout:20000});await pages[0].getByRole('button',{name:'Remove photo',exact:true}).click();await expect(pages[0].getByRole('button',{name:'Remove photo',exact:true})).toHaveCount(0);
   await pages[0].getByRole('button',{name:'Close profile',exact:true}).click();
   if(process.env.TEST_LIVE_ACTIVITY==='1'){const {checkLiveActivityUI}=await import('./check-live-activity-ui.mjs');await checkLiveActivityUI(pages,expect,admin,clients,group,users);}
   if(process.env.TEST_LIVE_RECOVERY==='1'){const {checkLiveMessageRecovery}=await import('./check-live-message-recovery.mjs');await checkLiveMessageRecovery(pages,expect,admin,group);}
   if(process.env.TEST_LIVE_AI_UI==='1'){const {checkLiveAIUI}=await import('./check-live-ai-ui.mjs');await checkLiveAIUI(pages,expect,admin,clients,group);}
   if(process.env.TEST_MUSIC_UPGRADE==='1'){const {checkMusicUpgrade}=await import('./check-live-music-upgrade.mjs');await checkMusicUpgrade(pages,expect,admin,group);}
   if(process.env.TEST_LIVE_COMPOSER==='1'){const {checkLiveComposerUI}=await import('./check-live-composer-ui.mjs');await checkLiveComposerUI(pages,expect,admin,group);}
   if(process.env.TEST_LIVE_SHARING==='1'){const {checkLiveSharingUI}=await import('./check-live-sharing-ui.mjs');await checkLiveSharingUI(pages,expect,admin,clients,group,users);}
   if(process.env.TEST_LIVE_PRIVATE==='1'){const {checkLivePrivateUI}=await import('./check-live-private-ui.mjs');await checkLivePrivateUI(pages,expect,admin,group);}
   if(process.env.TEST_LIVE_THEME==='1'){
    const page=pages[0];await page.getByRole('button',{name:'Appearance',exact:true}).click();const appearance=page.getByRole('dialog',{name:'Appearance',exact:true});await appearance.getByText('CSS editor',{exact:true}).click();await appearance.getByLabel('Theme CSS',{exact:true}).fill('.bubble { border-radius: 24px; } .ai-actions button { border-radius: 23px; }');await appearance.getByText('Interactive code playground',{exact:true}).click();await appearance.getByLabel('Sandbox code',{exact:true}).fill(`<button onclick="parent.postMessage({type:'chatter-ui',version:1,css:'.bubble { border-radius: 20px; }'},'*')">Live style check</button>`);await appearance.getByLabel('Enable live UI controls after applying',{exact:true}).check();await appearance.getByRole('button',{name:'Apply theme',exact:true}).click();await appearance.getByRole('button',{name:'Done',exact:true}).click();
    for(const p of pages)await p.getByRole('button',{name:'AI',exact:true}).click();await expect(page.locator('.ai-actions button').first()).toHaveCSS('border-radius','23px');await expect(pages[1].locator('.ai-actions button').first()).not.toHaveCSS('border-radius','23px');for(const p of pages)await p.getByRole('button',{name:'Chat',exact:true}).click();
    await expect(page.locator('.live-messages .bubble').first()).toHaveCSS('border-radius','24px');await expect(pages[1].locator('.live-messages .bubble').first()).not.toHaveCSS('border-radius','24px');await page.frameLocator('iframe[title="Your UI controls"]').getByRole('button',{name:'Live style check',exact:true}).click();await expect(page.locator('.live-messages .bubble').first()).toHaveCSS('border-radius','20px');await expect(pages[1].locator('.live-messages .bubble').first()).not.toHaveCSS('border-radius','20px');await page.getByRole('button',{name:'Pause UI code',exact:true}).click();await expect(page.locator('iframe[title="Your UI controls"]')).toHaveCount(0);
    await page.getByRole('button',{name:'Appearance',exact:true}).click();await appearance.getByRole('button',{name:'Reset',exact:true}).click();await appearance.getByRole('button',{name:'Done',exact:true}).click();
    console.log('PASS: hosted live UI bridge, trusted pause/reset and device-local styles that do not affect another signed-in browser.');
   }
   if(process.env.TEST_LIVE_BOARD==='1'){
    for(const page of pages)await page.getByRole('button',{name:'Board',exact:true}).click();
    await pages[0].getByRole('button',{name:'Create first tab',exact:true}).click();await pages[0].getByLabel('Tab name',{exact:true}).fill('Shared browser board');await pages[0].getByRole('button',{name:'Save tab',exact:true}).click();
    for(const page of pages)await expect(page.getByRole('tab',{name:'Shared browser board',exact:true})).toBeVisible({timeout:20000});
    async function draw(page,x){const canvas=page.getByLabel('Collaborative drawing canvas');const b=await canvas.boundingBox();await page.mouse.move(b.x+x,b.y+50);await page.mouse.down();await page.mouse.move(b.x+x+40,b.y+80,{steps:4});await page.mouse.up();await expect(page.getByText('Saved to your group',{exact:true})).toBeVisible({timeout:20000});}
    await Promise.all([draw(pages[0],50),draw(pages[1],150)]);
    for(const page of pages)await expect(page.locator('.board-canvas polyline')).toHaveCount(2,{timeout:20000});
    await pages[0].getByRole('button',{name:'Undo my last edit',exact:true}).click();
    for(const page of pages){await expect(page.locator('.board-canvas polyline')).toHaveCount(1,{timeout:20000});assert.match(await page.locator('.board-canvas polyline').getAttribute('points'),/^300,100/);}
    await pages[1].context().setOffline(true);await pages[0].getByRole('button',{name:'Redo my edit',exact:true}).click();await expect(pages[0].locator('.board-canvas polyline')).toHaveCount(2,{timeout:20000});await pages[1].context().setOffline(false);await pages[1].evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(pages[1].locator('.board-canvas polyline')).toHaveCount(2,{timeout:20000});
    await pages[0].getByRole('button',{name:'Text',exact:true}).click();await pages[0].getByLabel('Collaborative drawing canvas').click({position:{x:200,y:160}});await pages[0].getByRole('textbox',{name:'Text',exact:true}).fill('Live text recovery');await pages[0].getByRole('button',{name:'Save text',exact:true}).click();await expect(pages[0].locator('.board-canvas').getByText('Live text recovery',{exact:true})).toBeVisible({timeout:20000});
    let failure='after';const routePattern='**/rest/v1/rpc/write_board_shape';await pages[0].route(routePattern,async route=>{const mode=failure;failure='';if(mode==='before'){await route.abort('internetdisconnected');return;}if(mode==='after'){const response=await route.fetch();assert.ok(response.ok());await route.fulfill({status:503,json:{message:'Test lost acknowledgement'}});return;}await route.continue();});
    await pages[0].getByRole('button',{name:'Undo my last edit',exact:true}).click();await expect(pages[0].getByRole('button',{name:'Retry board save',exact:true})).toBeVisible({timeout:20000});await pages[0].getByRole('button',{name:'Retry board save',exact:true}).click();await expect(pages[0].getByText('Saved to your group',{exact:true})).toBeVisible({timeout:20000});await expect(pages[0].locator('.board-canvas').getByText('Live text recovery',{exact:true})).toHaveCount(0);
    failure='before';await pages[0].getByRole('button',{name:'Redo my edit',exact:true}).click();await expect(pages[0].getByRole('button',{name:'Retry board save',exact:true})).toBeVisible({timeout:20000});await pages[0].getByRole('button',{name:'Retry board save',exact:true}).click();await expect(pages[1].locator('.board-canvas').getByText('Live text recovery',{exact:true})).toBeVisible({timeout:20000});await pages[0].unroute(routePattern);
    const restored=check(await clients[0].from('board_shapes').select('revision').contains('data',{text:'Live text recovery'}).single());assert.equal(restored.revision,3,'Create, undo and redo must each commit once');
    console.log('PASS: hosted two-browser board tab discovery, concurrent drawing, own undo, reconnect and text undo/redo recovery before/after commit with exactly three revisions.');
    for(const page of pages)await page.getByRole('button',{name:'Chat',exact:true}).click();
   }
   if(process.env.TEST_NOTIFICATIONS==='1'){
    const page=pages[0];await page.getByRole('button',{name:'Group sounds',exact:true}).click();await page.getByRole('button',{name:'Enable sound',exact:true}).click();await page.getByRole('dialog',{name:'Group sounds',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
    const baseline=await page.evaluate(()=>window.__pings);check(await clients[1].rpc('send_group_message',{p_group_id:soundGroup,p_client_id:crypto.randomUUID(),p_body:'Other-group sound check'}));await expect.poll(()=>page.evaluate(()=>window.__pings),{timeout:20000}).toBeGreaterThan(baseline);
    await page.evaluate(({user,group})=>localStorage.setItem('chatter:sounds:'+user+':'+group,JSON.stringify({muted:true,senders:{}})),{user:users[0],group:soundGroup});
    const mutedBaseline=await page.evaluate(()=>window.__pings);check(await clients[1].rpc('send_group_message',{p_group_id:soundGroup,p_client_id:crypto.randomUUID(),p_body:'Muted-group sound check'}));await page.waitForTimeout(2000);assert.equal(await page.evaluate(()=>window.__pings),mutedBaseline);
    console.log('PASS: real realtime sound from another joined group and per-group mute override.');
   }
   if(process.env.TEST_LIVE_MUSIC==='1'){const {checkLiveMusicUI}=await import('./check-live-music-ui.mjs');await checkLiveMusicUI(pages,expect);}
   if(process.env.TEST_LIVE_APPLE==='1'){const {checkLiveAppleUI}=await import('./check-live-apple-ui.mjs');await checkLiveAppleUI(pages,expect);}
   if(process.env.TEST_LIVE_PLAYLIST==='1'){const {checkLivePlaylistUI}=await import('./check-live-playlist-ui.mjs');await checkLivePlaylistUI(pages,expect);}
   if(process.env.TEST_LIVE_YOUTUBE_END==='1'){const {checkLiveYouTubeEndUI}=await import('./check-live-youtube-end-ui.mjs');await checkLiveYouTubeEndUI(pages,expect);}
   if(process.env.TEST_LIVE_VOICE==='1'){
    for(const page of pages){await page.getByRole('button',{name:/Voice room/}).click();await page.getByRole('button',{name:'Join voice',exact:true}).click();await expect(page.getByRole('button',{name:'Leave voice',exact:true})).toBeVisible({timeout:20000});assert.equal(await page.evaluate(()=>window.__voiceStreams[0].getAudioTracks()[0].enabled),false);}
    for(const page of pages)await expect(page.locator('.voice-body li small').filter({hasText:'connected'})).toBeVisible({timeout:30000});
    await pages[0].getByLabel('Microphone mode',{exact:true}).selectOption('open');await pages[0].getByRole('button',{name:'Unmute microphone',exact:true}).click();assert.equal(await pages[0].evaluate(()=>window.__voiceStreams[0].getAudioTracks()[0].enabled),true);
    await expect.poll(()=>pages[1].evaluate(async()=>{const stats=await window.__voicePeers[0].getStats();let bytes=0;stats.forEach(s=>{if(s.type==='inbound-rtp'&&s.kind==='audio')bytes+=s.bytesReceived||0;});return bytes;}),{timeout:20000}).toBeGreaterThan(0);
    for(const page of pages){await expect.poll(()=>page.locator('.voice-room audio').evaluateAll(nodes=>nodes.length>0&&nodes.every(a=>!a.paused))).toBe(true);await expect(page.getByRole('button',{name:/Enable audio for/})).toHaveCount(0);}
    await pages[0].evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await pages[0].evaluate(()=>window.__voiceStreams[0].getAudioTracks()[0].enabled),false);
    await pages[0].getByLabel('Microphone mode',{exact:true}).selectOption('hold');const hold=pages[0].getByRole('button',{name:'Hold to talk',exact:true});await hold.focus();await pages[0].keyboard.down('Space');assert.equal(await pages[0].evaluate(()=>window.__voiceStreams[0].getAudioTracks()[0].enabled),true);await pages[0].keyboard.up('Space');assert.equal(await pages[0].evaluate(()=>window.__voiceStreams[0].getAudioTracks()[0].enabled),false);
    await pages[0].screenshot({path:'docs/design/voice-desktop.png'});await pages[1].screenshot({path:'docs/design/voice-mobile.png'});
    for(const page of pages){await page.getByRole('button',{name:'Leave voice',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__voiceStreams[0].getTracks().every(t=>t.readyState==='ended'))).toBe(true);}
    console.log('PASS: two-browser real WebRTC audio packets, muted entry, open mic, blur mute, keyboard push-to-talk and track teardown. Direct local-network test only.');
   }
   console.log('PASS: real desktop/mobile sign-in, cross-browser group message and profile photo upload/removal.');
  }finally{await browser.close();}
 }
 if(process.env.TEST_LIVE_AI==='1'){
  check(await clients[0].rpc('set_group_ai',{p_group_id:group,p_enabled:true}));
  const messageId=check(await clients[0].rpc('send_group_message',{p_group_id:group,p_client_id:crypto.randomUUID(),p_body:'Our fictional study session is Friday at 3 PM in the library. Bring a notebook.'}));
  const clientId=crypto.randomUUID();
  const result=check(await clients[0].functions.invoke('group-ai',{body:{groupId:group,kind:'summary',clientId}}));
  const job=check(await clients[1].from('ai_jobs').select('state,result,sources').eq('id',result.jobId).single());
  assert.equal(job.state,'done','Hosted AI job must finish successfully');assert.ok(job.result.trim());assert.ok(job.sources.includes(messageId));
  const retry=check(await clients[0].functions.invoke('group-ai',{body:{groupId:group,kind:'summary',clientId}}));assert.equal(retry.jobId,result.jobId);
  console.log('PASS: deployed AI summary, member-visible result, source attribution and idempotent retry.');
 }
 const tab=check(await clients[0].rpc('create_board_tab',{p_group_id:group,p_name:'Concurrent test'}));
 const shapes=[crypto.randomUUID(),crypto.randomUUID()];
 const shapeData={kind:'pen',color:'#076371',width:3,points:[[1,1],[80,80]]};
 await Promise.all(clients.map(async(c,i)=>check(await c.rpc('write_board_shape',{p_tab_id:tab,p_shape_id:shapes[i],p_revision:0,p_data:shapeData,p_deleted:false}))));
 assert.equal(check(await clients[0].from('board_shapes').select('id').eq('tab_id',tab)).length,2);
 assert.ok((await clients[1].rpc('write_board_shape',{p_tab_id:tab,p_shape_id:shapes[0],p_revision:0,p_data:shapeData,p_deleted:false})).error);
 const blob=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAOUlEQVR4nO3RwQkAMAzDQBc6d7p6R1A+/ukGcEA5mZemW12PBxb8ATIRMhEyETIRMhEyETIRMlHIBwIIAXu5uNt2AAAAAElFTkSuQmCC','base64')],{type:'image/png'});
 const avatarForm=new FormData();avatarForm.set('file',blob,'avatar.png');avatarAsset=check(await clients[0].functions.invoke('upload-avatar',{body:avatarForm})).path;
 assert.equal(check(await clients[1].storage.from('profile-avatars').download(avatarAsset)).size,blob.size);
 const outsider=createClient(url,publicKey,{auth:{persistSession:false}});assert.ok((await outsider.storage.from('profile-avatars').download(avatarAsset)).error);
 check(await clients[0].rpc('remove_avatar'));assert.ok((await clients[1].storage.from('profile-avatars').download(avatarAsset)).error);
 console.log('PASS: real avatar upload, shared-group access, anonymous denial and immediate removal access denial.');
 const item=check(await clients[0].rpc('reserve_media',{p_group_id:group,p_kind:'story',p_caption:'Temporary test',p_mime:'image/png',p_bytes:blob.size}));asset=item.object_path;
 const form=new FormData();form.set('contentId',item.id);form.set('file',blob,'test.png');check(await clients[0].functions.invoke('upload-media',{body:form}));check(await clients[0].rpc('publish_media',{p_content_id:item.id}));assert.equal(check(await clients[1].storage.from('group-media').download(asset)).size,blob.size);
 check(await clients[0].functions.invoke('remove-content',{body:{contentId:item.id}}));assert.ok((await clients[1].storage.from('group-media').download(asset)).error);
 if(process.env.TEST_LIVE_VIDEO==='1')for(const ext of ['mp4','webm'])for(const seconds of [1,31]){
  const video=new Blob([await readFile(`test-results/media/${seconds}.${ext}`)],{type:'video/'+ext});
  const reservation=check(await clients[0].rpc('reserve_media',{p_group_id:group,p_kind:'reel',p_caption:'Duration check',p_mime:video.type,p_bytes:video.size}));extraAssets.push(reservation.object_path);
  const form=new FormData();form.set('contentId',reservation.id);form.set('file',video,'clip.'+ext);
  const uploaded=await clients[0].functions.invoke('upload-media',{body:form});
  if(seconds===1){check(uploaded);check(await clients[0].rpc('publish_media',{p_content_id:reservation.id}));}else{assert.ok(uploaded.error,'Long videos must be rejected by the server');assert.equal(uploaded.error.context.status,400);}
  check(await clients[0].functions.invoke('remove-content',{body:{contentId:reservation.id}}));
 }
 if(process.env.TEST_LIVE_VIDEO==='1')console.log('PASS: deployed MP4/WebM duration checks accepted one-second clips and rejected 31-second clips.');
 const activity=check(await clients[0].rpc('group_activity',{p_group_id:group}));assert.equal(activity.today.required,2);
 const chat=check(await clients[0].rpc('request_private_chat',{p_group_id:group,p_recipient_id:users[1]}));check(await clients[1].rpc('respond_private_chat',{p_chat_id:chat,p_accept:true}));check(await clients[0].rpc('send_private_message',{p_chat_id:chat,p_client_id:crypto.randomUUID(),p_body:'Temporary verification'}));check(await clients[1].rpc('set_member_block',{p_group_id:group,p_member_id:users[0],p_blocked:true}));assert.equal(check(await clients[0].from('private_messages').select('id').eq('chat_id',chat)).length,0);
 check(await clients[1].rpc('leave_group',{p_group_id:group}));const blocked=check(await clients[1].rpc('blocked_accounts'));assert.equal(blocked.length,1);assert.equal(blocked[0].user_id,users[0]);assert.equal(typeof blocked[0].display_name,'string');assert.deepEqual(check(await clients[0].rpc('blocked_accounts')),[]);check(await clients[1].rpc('set_member_block',{p_group_id:null,p_member_id:users[0],p_blocked:false}));assert.deepEqual(check(await clients[1].rpc('blocked_accounts')),[]);
 console.log('PASS: hosted own-block recovery and unblocking after leaving the shared group, without disclosure to the other account.');
 console.log('PASS: real Auth sessions, invite join, private Storage upload/read/delete, cleanup Edge Function, activity, concurrent board edits/stale-write rejection and block closure. No emails sent.');
}finally{
 if(extraAssets.length)check(await admin.storage.from('group-media').remove(extraAssets));
 if(avatarAsset){check(await admin.storage.from('profile-avatars').remove([avatarAsset]));check(await admin.rpc('finish_avatar_cleanup',{p_path:avatarAsset}));}
 if(asset)check(await admin.storage.from('group-media').remove([asset]));
 if(soundGroup&&clients[0])check(await clients[0].rpc('delete_group',{p_group_id:soundGroup,p_name:'Temporary sound check'}));
 if(group&&clients[0])check(await clients[0].rpc('delete_group',{p_group_id:group,p_name:'Temporary integration check'}));
 for(const id of users)check(await admin.auth.admin.deleteUser(id));
 console.log('Temporary hosted test accounts and group removed.');
}
