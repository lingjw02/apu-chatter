import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
const users=Array.from({length:4},()=>crypto.randomUUID());
for(const id of users)await db.query('insert into auth.users(id,email_confirmed_at)values($1,now())',[id]);
async function as(i){await db.exec('reset role');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[users[i]]);await db.exec('set role authenticated');}
async function rpc(name,args=[]){return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;}
await as(0);const g=await rpc('create_group',['Private test','','UTC']);const invite=await rpc('create_invite',[g]);
for(let i=1;i<3;i++){await as(i);await rpc('join_group',[invite.token]);}
await as(1);const chat=await rpc('request_private_chat',[g,users[2]]);
assert.equal(await rpc('request_private_chat',[g,users[2]]),chat);
await assert.rejects(rpc('request_private_chat',[g,users[1]]));
await assert.rejects(rpc('request_private_chat',[g,users[3]]));
await assert.rejects(rpc('respond_private_chat',[chat,true]));
await assert.rejects(rpc('send_private_message',[chat,crypto.randomUUID(),'Too early']));
await as(2);assert.equal(await rpc('request_private_chat',[g,users[1]]),chat);await rpc('respond_private_chat',[chat,true]);
await as(1);const client=crypto.randomUUID();const msg=await rpc('send_private_message',[chat,client,'Secret text']);assert.equal(await rpc('send_private_message',[chat,client,'Secret text']),msg);
await assert.rejects(rpc('send_private_message',[chat,crypto.randomUUID(),'   ']));
await assert.rejects(rpc('send_private_message',[chat,crypto.randomUUID(),'x'.repeat(4001)]));
await as(0);assert.equal((await db.query('select * from public.private_messages')).rows.length,0);assert.equal((await db.query('select * from public.private_chats')).rows.length,0);await assert.rejects(rpc('close_private_chat',[chat]));
await as(3);await assert.rejects(rpc('request_private_chat',[g,users[1]]));
await as(2);assert.equal((await db.query('select * from public.private_messages')).rows.length,1);await rpc('close_private_chat',[chat]);
await as(1);await assert.rejects(rpc('send_private_message',[chat,crypto.randomUUID(),'After close']));
await db.exec('reset role');assert.equal((await db.query('select * from public.private_messages')).rows.length,0);
await as(1);const next=await rpc('request_private_chat',[g,users[2]]);assert.notEqual(next,chat);
await as(2);await rpc('respond_private_chat',[next,false]);
await as(1);const expiring=await rpc('request_private_chat',[g,users[2]]);await db.exec('reset role');await db.query(`update public.private_chats set expires_at=now()-interval '1 minute' where id=$1`,[expiring]);
await as(2);await assert.rejects(rpc('respond_private_chat',[expiring,true]));const fresh=await rpc('request_private_chat',[g,users[1]]);assert.notEqual(fresh,expiring);
await as(1);await rpc('respond_private_chat',[fresh,true]);await rpc('send_private_message',[fresh,crypto.randomUUID(),'Delete on leave']);
await as(2);await rpc('leave_group',[g]);await db.exec('reset role');assert.equal((await db.query('select * from public.private_messages')).rows.length,0);assert.equal((await db.query('select state from public.private_chats where id=$1',[fresh])).rows[0].state,'closed');
await as(2);await rpc('join_group',[invite.token]);const removal=await rpc('request_private_chat',[g,users[1]]);await as(1);await rpc('respond_private_chat',[removal,true]);await rpc('send_private_message',[removal,crypto.randomUUID(),'Delete on removal']);await as(0);await rpc('remove_member',[g,users[2]]);await db.exec('reset role');assert.equal((await db.query('select * from public.private_messages')).rows.length,0);
console.log('PASS: consent, pair uniqueness, participant-only reads, owner isolation, idempotent sends, expiry, close/leave/removal delete messages.');
await db.close();
