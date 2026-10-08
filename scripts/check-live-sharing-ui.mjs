// Hosted newcomer/history/media acceptance; invoked by the synthetic-account runner.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
export async function checkLiveSharingUI(existingPages,expect,admin,existingClients,group,users){
 const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
 const owner=existingPages[0],paths=[];let passed=false,context,newUser;
 const clients=[existingClients[0]],pages=[owner];let newcomer;
 const email='newcomer-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+crypto.randomUUID();
 const labels={shared:'Before joining: shared photo',story:'Before joining: archived story',chat:'Before joining: chat photo'};
 const memory=(page,label)=>page.locator('.sharing-open').filter({hasText:label});
 try{
  newUser=check(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'First-time newcomer'}})).user.id;
  const client=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false}});check(await client.auth.signInWithPassword({email,password}));clients.push(client);
  context=await owner.context().browser().newContext({viewport:{width:390,height:844}});newcomer=await context.newPage();pages.push(newcomer);
  // More than one page, dated before the join; content is synthetic and group-scoped.
  const messages=Array.from({length:55},(_,i)=>({group_id:group,author_id:users[0],client_id:crypto.randomUUID(),body:'Newcomer history '+String(i).padStart(2,'0'),created_at:new Date(Date.now()-3600000+(i*1000)).toISOString()}));
  check(await admin.from('group_messages').insert(messages));
  await owner.locator('.tabs-row').getByRole('button',{name:'Stories',exact:true}).click();
  for(const kind of ['shared','story','chat']){
   await owner.getByRole('button',{name:'New update',exact:true}).click();await owner.getByRole('dialog',{name:'Share with your group',exact:true}).getByRole('combobox').selectOption(kind);await owner.getByLabel('Caption',{exact:true}).fill(labels[kind]);await owner.getByLabel('Photo or video',{exact:true}).setInputFiles('scripts/fixtures/avatar.png');await owner.getByRole('button',{name:'Share with group',exact:true}).click();
   await expect(owner.getByRole('dialog',{name:'Share with your group',exact:true})).toHaveCount(0,{timeout:30000});
   const item=check(await admin.from('group_content').select('id,object_path').eq('group_id',group).eq('caption',labels[kind]).single());paths.push(item.object_path);
   if(kind==='story')check(await admin.from('group_content').update({created_at:new Date(Date.now()-25*3600000).toISOString()}).eq('id',item.id));
  }
  await owner.getByRole('button',{name:'New update',exact:true}).click();await owner.getByLabel('Caption',{exact:true}).fill('Newcomer unread post');await owner.getByRole('button',{name:'Share with group',exact:true}).click();await expect(memory(owner,'Newcomer unread post')).toBeVisible({timeout:20000});
  const invite=check(await clients[0].rpc('create_invite',{p_group_id:group}));check(await clients[1].rpc('join_group',{p_token:invite.token}));
  await newcomer.goto((process.env.TEST_UI_ORIGIN||'https://apu-chatter.pages.dev')+'/login');await newcomer.getByLabel('Email address',{exact:true}).fill(email);await newcomer.locator('input[type=password]').fill(password);await newcomer.getByRole('button',{name:'Sign in',exact:true}).click();await expect(newcomer.getByRole('heading',{name:'Temporary integration check',exact:true})).toBeVisible({timeout:20000});
  await expect(newcomer.getByText('Newcomer history 54',{exact:true})).toBeVisible({timeout:20000});
  await newcomer.getByRole('button',{name:'Load earlier messages',exact:true}).click();await expect(newcomer.getByText('Newcomer history 00',{exact:true})).toBeVisible({timeout:20000});
  await newcomer.getByRole('button',{name:'View Smoke 0 updates, unread updates',exact:true}).first().click();await expect(newcomer.getByRole('button',{name:'Show everyone’s updates',exact:true})).toBeVisible();
  await expect(memory(newcomer,labels.story)).toHaveCount(0);await memory(newcomer,'Newcomer unread post').click();await newcomer.getByRole('button',{name:'Close memory',exact:true}).click();await newcomer.getByRole('button',{name:'Chat',exact:true}).click();
  await expect(newcomer.getByRole('button',{name:'View Smoke 0 updates',exact:true}).first()).toBeVisible({timeout:20000});await expect(newcomer.getByRole('button',{name:'View Smoke 0 updates, unread updates',exact:true})).toHaveCount(0);
  await newcomer.getByRole('button',{name:'Albums',exact:true}).click();
  for(const [kind,folder] of [['shared','Shared folder'],['story','Stories'],['chat','Chat media']]){
   await newcomer.getByRole('navigation',{name:'Album folders'}).getByRole('button',{name:folder,exact:true}).click();await newcomer.reload();await expect(newcomer.locator('.tabs-row button.active')).toHaveText('Albums');await memory(newcomer,labels[kind]).click();
   const img=newcomer.getByRole('dialog',{name:'Shared memory',exact:true}).getByRole('img',{name:labels[kind],exact:true});await expect(img).toBeVisible({timeout:20000});await expect.poll(()=>img.evaluate(node=>node.complete&&node.naturalWidth>0)).toBe(true);await newcomer.getByRole('button',{name:'Close memory',exact:true}).click();
  }
  // A single deletion must revoke both the canonical record and storage access.
  await owner.getByRole('button',{name:'Albums',exact:true}).click();await owner.getByRole('navigation',{name:'Album folders'}).getByRole('button',{name:'Stories',exact:true}).click();await memory(owner,labels.story).click();await owner.getByRole('button',{name:'Delete memory',exact:true}).click();await owner.getByRole('button',{name:'Keep memory',exact:true}).click();await expect(owner.getByRole('dialog',{name:'Shared memory',exact:true})).toBeVisible();
  await owner.getByRole('button',{name:'Delete memory',exact:true}).click();await owner.getByRole('button',{name:'Delete everywhere',exact:true}).click();await expect(owner.getByRole('dialog',{name:'Shared memory',exact:true})).toHaveCount(0,{timeout:20000});
  await newcomer.getByRole('navigation',{name:'Album folders'}).getByRole('button',{name:'Stories',exact:true}).click();await expect(memory(newcomer,labels.story)).toHaveCount(0,{timeout:20000});assert.ok((await clients[1].storage.from('group-media').download(paths[1])).error);
  passed=true;console.log('PASS: hosted newcomer pre-join paginated history, unread author navigation/seen state, decoded images in all three albums, expired-story archive and canonical deletion/access revocation.');
 }catch(error){console.log('Sharing UI alerts:',await owner.getByRole('alert').allTextContents());throw error;}finally{
  // Remove only this helper’s temporary uploaded objects; parent removes group rows.
  if(paths.length)check(await admin.storage.from('group-media').remove(paths));
  await context?.close();if(newUser)check(await admin.auth.admin.deleteUser(newUser));
  if(passed)for(const page of [owner]){const close=page.getByRole('button',{name:'Close memory',exact:true});if(await close.count())await close.click();await page.getByRole('button',{name:'Chat',exact:true}).click();}
 }
}
