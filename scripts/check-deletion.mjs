import { PGlite } from '@electric-sql/pglite';
import { readFile,readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
const ids=Array.from({length:4},()=>crypto.randomUUID());for(const id of ids)await db.query('insert into auth.users(id,email_confirmed_at)values($1,now())',[id]);
async function as(i){await db.exec('reset role');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[ids[i]]);await db.exec('set role authenticated');}
async function rpc(n,a=[]){return(await db.query(`select public.${n}(${a.map((_,i)=>'$'+(i+1)).join(',')}) as r`,a)).rows[0].r;}
await as(0);const g=await rpc('create_group',['Deletion','','UTC']),inv=await rpc('create_invite',[g]);for(const i of [1,2]){await as(i);await rpc('join_group',[inv.token]);}
await as(1);const client=crypto.randomUUID(),m=await rpc('send_group_message',[g,client,'Erase this content']);
await as(2);await assert.rejects(rpc('delete_group_message',[m]));await as(3);await assert.rejects(rpc('delete_group_message',[m]));
await as(1);await rpc('delete_group_message',[m]);await rpc('delete_group_message',[m]);assert.equal(await rpc('send_group_message',[g,client,'Erase this content']),m);
let row=(await db.query('select * from public.group_messages where id=$1',[m])).rows[0];assert.equal(row.body,'Message deleted');assert.ok(row.deleted_at);
const n=await rpc('send_group_message',[g,crypto.randomUUID(),'Owner removes']);await as(0);await rpc('delete_group_message',[n]);await rpc('set_member_role',[g,ids[2],'admin']);
await as(1);const a=await rpc('send_group_message',[g,crypto.randomUUID(),'Admin removes']);await as(2);await rpc('delete_group_message',[a]);await assert.rejects(db.query(`update public.group_messages set body='Restored' where id=$1`,[a]));
await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from public.group_messages where body<>'Message deleted'")).rows[0].n,0);
console.log('PASS: author/owner/admin deletion, outsider/peer denial, erased bodies, retry cannot restore, direct writes denied.');await db.close();
