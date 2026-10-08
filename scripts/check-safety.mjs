import { PGlite } from '@electric-sql/pglite';
import { readFile,readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
const ids=Array.from({length:3},()=>crypto.randomUUID());for(const id of ids)await db.query('insert into auth.users(id,email_confirmed_at)values($1,now())',[id]);
async function as(i){await db.exec('reset role');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[ids[i]]);await db.exec('set role authenticated');}
async function rpc(n,a=[]){return(await db.query(`select public.${n}(${a.map((_,i)=>'$'+(i+1)).join(',')}) as r`,a)).rows[0].r;}
await as(0);const g=await rpc('create_group',['Safety','','UTC']),inv=await rpc('create_invite',[g]);for(const i of [1,2]){await as(i);await rpc('join_group',[inv.token]);}
await as(1);const c=await rpc('request_private_chat',[g,ids[2]]);await as(2);await rpc('respond_private_chat',[c,true]);await rpc('send_private_message',[c,crypto.randomUUID(),'Erase on block']);
await as(1);await rpc('set_member_block',[g,ids[2],true]);await assert.rejects(rpc('request_private_chat',[g,ids[2]]));await as(2);await assert.rejects(rpc('request_private_chat',[g,ids[1]]));assert.equal((await db.query('select * from public.member_blocks')).rows.length,0);
await db.exec('reset role');assert.equal((await db.query('select * from public.private_messages')).rows.length,0);
await as(1);const report=await rpc('report_member',[g,ids[2],'Unwanted contact']);await assert.rejects(rpc('resolve_report',[report]));await as(2);assert.equal((await db.query('select * from public.member_reports')).rows.length,0);await assert.rejects(rpc('delete_group',[g,'Safety']));
await as(0);assert.equal((await db.query('select * from public.member_reports')).rows.length,1);await rpc('resolve_report',[report]);await assert.rejects(rpc('delete_group',[g,'Wrong name']));
await as(1);await rpc('set_member_block',[g,ids[2],false]);assert.ok(await rpc('request_private_chat',[g,ids[2]]));await as(0);await rpc('delete_group',[g,'Safety']);assert.equal((await db.query('select * from public.groups')).rows.length,0);
console.log('PASS: blocking both directions, message erasure, block/report privacy, owner resolution and exact-name group deletion.');await db.close();
