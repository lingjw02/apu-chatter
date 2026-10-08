// Real hosted UI acceptance. Creates only confirmed synthetic users; sends no email.
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const result=spawnSync('cmd.exe',['/d','/s','/c','npx supabase projects api-keys --project-ref ynnzfygliidbwgvpkxjl --output json --reveal'],{encoding:'utf8'});
if(result.status!==0)throw Error('Administrative test credentials unavailable');
const secret=JSON.parse(result.stdout).find(k=>k.name==='service_role')?.api_key;
if(!secret)throw Error('Administrative credential unavailable');
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_ANON_KEY;
const admin=createClient(url,secret,{auth:{persistSession:false}});
const users=[],clients=[],pages=[];let group,browser;
const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
const origin=process.env.TEST_UI_ORIGIN||'https://apu-chatter.pages.dev';
const member=(i,n)=>pages[i].locator('.managed-members article').filter({has:pages[i].getByText('Moderation '+n+(i===n?' (you)':''),{exact:true})});
async function controls(i){await pages[i].getByRole('button',{name:'Members',exact:true}).click();await expect(pages[i].locator('.managed-members article')).toHaveCount(4,{timeout:20000});}
async function votes(i){await pages[i].getByRole('button',{name:'Votes',exact:true}).click();}
const card=(i,n)=>pages[i].locator('.vote-card').filter({has:pages[i].getByText('Moderation '+n,{exact:true})}).first();
async function start(i,n){await member(i,n).getByRole('button',{name:'Start kick / keep vote',exact:true}).click();await pages[i].getByRole('button',{name:'Start vote',exact:true}).click();await expect(pages[i].getByText('Group updated.',{exact:true})).toBeVisible();await votes(i);}
async function cast(i,n){await votes(i);await card(i,n).getByRole('button',{name:'Kick',exact:true}).click();await expect(card(i,n).getByRole('button',{name:'Kick',exact:true})).toHaveCount(0,{timeout:20000});}
async function membership(n){return check(await admin.from('memberships').select('role').eq('group_id',group).eq('user_id',users[n]).maybeSingle());}
try{
 browser=await chromium.launch();
 const credentials=[];
 for(let i=0;i<4;i++){
  const email='moderation-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+crypto.randomUUID();
  const user=check(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Moderation '+i}})).user;
  users.push(user.id);credentials.push({email,password});
  const client=createClient(url,key,{auth:{persistSession:false}});check(await client.auth.signInWithPassword({email,password}));clients.push(client);
 }
 group=check(await clients[0].rpc('create_group',{p_name:'Hosted moderation acceptance',p_description:'Temporary release check',p_timezone:'Asia/Kuala_Lumpur'}));
 const invite=check(await clients[0].rpc('create_invite',{p_group_id:group}));
 for(let i=1;i<4;i++)check(await clients[i].rpc('join_group',{p_token:invite.token}));
 for(let i=0;i<4;i++){
  const context=await browser.newContext({viewport:i===3?{width:390,height:844}:{width:1440,height:1000}}),page=await context.newPage();pages.push(page);
  await page.goto(origin+'/login');await page.getByLabel('Email address',{exact:true}).fill(credentials[i].email);await page.locator('input[type=password]').fill(credentials[i].password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Hosted moderation acceptance',exact:true})).toBeVisible({timeout:20000});await controls(i);
 }
 // Protected owner has no removal/vote action, even for other members.
 for(let i=1;i<4;i++)await expect(member(i,0).getByRole('button')).toHaveCount(0);
 assert.ok((await clients[2].rpc('start_kick_vote',{p_group_id:group,p_target_id:users[0]})).error);
 await member(0,1).getByRole('button',{name:'Make admin',exact:true}).click();await pages[0].getByRole('button',{name:'Confirm role',exact:true}).click();
 await expect(member(0,1).getByText('Admin',{exact:true})).toBeVisible({timeout:20000});assert.equal((await membership(1)).role,'admin');
 // A report is visible to its author and owner, not the target or another admin.
 await pages[2].getByRole('button',{name:'Safety',exact:true}).click();
 await pages[2].locator('.ban-row').filter({hasText:'Moderation 3'}).getByRole('button',{name:'Block or report',exact:true}).click();
 await expect(pages[2].getByRole('button',{name:'Send report',exact:true})).toBeDisabled();
 await pages[2].route('**/rest/v1/rpc/report_member',route=>route.fulfill({status:503,json:{message:'Synthetic pre-send failure'}}),{times:1});
 await pages[2].locator('.safety-form textarea').fill('Synthetic report privacy acceptance');await pages[2].getByRole('button',{name:'Send report',exact:true}).click();await expect(pages[2].getByRole('alert')).toContainText('Unable to complete this action');await expect(pages[2].locator('.safety-form textarea')).toHaveValue('Synthetic report privacy acceptance');await pages[2].getByRole('button',{name:'Send report',exact:true}).click();
 await expect(pages[2].locator('.safety-report')).toContainText('Synthetic report privacy acceptance',{timeout:20000});
 const report=check(await clients[2].from('member_reports').select('id,resolved_at').eq('group_id',group).single());assert.equal(report.resolved_at,null);
 for(const i of [1,3]){
  await pages[i].getByRole('button',{name:'Safety',exact:true}).click();await expect(pages[i].getByText('No reports.',{exact:true})).toBeVisible();
  assert.deepEqual(check(await clients[i].from('member_reports').select('id').eq('id',report.id)),[]);
  assert.ok((await clients[i].rpc('resolve_report',{p_report_id:report.id})).error);
 }
 await pages[0].getByRole('button',{name:'Safety',exact:true}).click();await expect(pages[0].locator('.safety-report')).toContainText('Synthetic report privacy acceptance',{timeout:20000});await pages[0].getByRole('button',{name:'Mark resolved',exact:true}).click();await expect(pages[0].locator('.safety-report')).toContainText('Resolved');
 await pages[2].getByRole('button',{name:'Members (4)',exact:true}).click();await pages[2].getByRole('button',{name:'Safety',exact:true}).click();await expect(pages[2].locator('.safety-report')).toContainText('Resolved',{timeout:20000});assert.ok(check(await clients[2].from('member_reports').select('resolved_at').eq('id',report.id).single()).resolved_at);
 for(const page of pages)await page.getByRole('button',{name:'Members (4)',exact:true}).click();
 console.log('PASS: hosted report submission, reporter/owner visibility, admin/target read and resolve denial, and owner resolution visible to reporter.');
 // Ordinary target: ceil(50% of three other members)=2; one ballot cannot remove.
 await start(2,3);await expect(card(2,3)).toContainText('2 of 3 needed');await cast(2,3);assert.ok(await membership(3));
 await cast(0,3);await expect(card(0,3).locator('.vote-status')).toHaveText('passed',{timeout:20000});assert.equal(await membership(3),null);
 assert.ok((await clients[3].rpc('join_group',{p_token:invite.token})).error,'Removed member cannot reuse invite');
 check(await clients[3].from('group_messages').select('id')).forEach(()=>assert.fail('Removed member read group messages'));
 await pages[0].getByRole('button',{name:'Removed',exact:true}).click();await pages[0].locator('.ban-row').filter({hasText:'Moderation 3'}).getByRole('button',{name:'Allow back',exact:true}).click();await pages[0].getByRole('button',{name:'Allow re-entry',exact:true}).click();await expect(pages[0].getByRole('button',{name:'Allow re-entry',exact:true})).toHaveCount(0,{timeout:20000});await expect(pages[0].getByText('Group updated.',{exact:true})).toBeVisible();
 await expect(pages[0].locator('.ban-row')).toHaveCount(0,{timeout:20000});check(await clients[3].rpc('join_group',{p_token:invite.token}));assert.equal((await membership(3)).role,'member');
 console.log('PASS: hosted owner protection, UI promotion, ordinary 2/3 threshold, automatic removal, invite ban and UI re-entry.');
 // Reopen controls to observe the new electorate after re-entry.
 for(let i=0;i<4;i++){await pages[i].reload();await expect(pages[i].getByRole('heading',{name:'Hosted moderation acceptance',exact:true})).toBeVisible({timeout:20000});await controls(i);}
 await start(2,1);await expect(card(2,1)).toContainText('3 of 3 needed');await cast(2,1);await cast(0,1);assert.equal((await membership(1)).role,'admin');
 await cast(3,1);await expect(card(3,1).locator('.vote-status')).toHaveText('passed',{timeout:20000});assert.equal(await membership(1),null);
 await pages[0].getByRole('button',{name:'Removed',exact:true}).click();await pages[0].locator('.ban-row').filter({hasText:'Moderation 1'}).getByRole('button',{name:'Allow back',exact:true}).click();await pages[0].getByRole('button',{name:'Allow re-entry',exact:true}).click();await expect(pages[0].getByRole('button',{name:'Allow re-entry',exact:true})).toHaveCount(0,{timeout:20000});await expect(pages[0].getByText('Group updated.',{exact:true})).toBeVisible();
 await expect(pages[0].locator('.ban-row')).toHaveCount(0,{timeout:20000});check(await clients[1].rpc('join_group',{p_token:invite.token}));assert.equal((await membership(1)).role,'member');
 console.log('PASS: hosted unanimous admin threshold (2 insufficient, 3 remove), owner re-entry and former-admin role reset.');
 // Transfer ownership through the real confirmation, then delete this synthetic group.
 for(const i of [0,1]){await pages[i].reload();await expect(pages[i].getByRole('heading',{name:'Hosted moderation acceptance',exact:true})).toBeVisible({timeout:20000});await controls(i);}
 await member(0,1).getByRole('button',{name:'Transfer ownership',exact:true}).click();await pages[0].getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await membership(0)).role,'owner');
 await member(0,1).getByRole('button',{name:'Transfer ownership',exact:true}).click();await pages[0].getByRole('button',{name:'Transfer ownership',exact:true}).click();
 await expect(member(0,1).getByText('Owner · protected from removal',{exact:true})).toBeVisible({timeout:20000});assert.equal((await membership(0)).role,'admin');assert.equal((await membership(1)).role,'owner');
 await pages[0].getByRole('button',{name:'Safety',exact:true}).click();await expect(pages[0].getByRole('button',{name:'Delete this group',exact:true})).toHaveCount(0);
 await expect(member(1,1).getByText('Owner · protected from removal',{exact:true})).toBeVisible({timeout:20000});await pages[1].getByRole('button',{name:'Safety',exact:true}).click();
 await pages[1].getByRole('button',{name:'Delete this group',exact:true}).click();await pages[1].getByRole('button',{name:'Keep group',exact:true}).click();assert.ok(check(await admin.from('groups').select('id').eq('id',group).maybeSingle()));
 await pages[1].getByRole('button',{name:'Delete this group',exact:true}).click();await expect(pages[1].getByRole('button',{name:'Permanently delete group',exact:true})).toBeDisabled();await pages[1].getByLabel('Group name to confirm deletion',{exact:true}).fill('Hosted moderation acceptance');await pages[1].getByRole('button',{name:'Permanently delete group',exact:true}).click();
 await expect.poll(async()=>check(await admin.from('groups').select('id').eq('id',group).maybeSingle()),{timeout:20000}).toBeNull();
 await expect(pages[1].getByRole('heading',{name:'Hosted moderation acceptance',exact:true})).toHaveCount(0,{timeout:20000});
 console.log('PASS: hosted ownership transfer/cancel, old-owner permission loss, delete cancellation, exact-name confirmation and live group deletion.');
}finally{
 await browser?.close();
 if(group)check(await admin.from('groups').delete().eq('id',group));
 for(const id of users)check(await admin.auth.admin.deleteUser(id));
 console.log('Temporary moderation group/accounts removed.');
}
