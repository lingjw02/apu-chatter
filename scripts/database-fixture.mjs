import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
export async function fixture(count=6){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 for(const f of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const ids=Array.from({length:count},()=>crypto.randomUUID());for(const id of ids)await db.query('insert into auth.users(id,email_confirmed_at)values($1,now())',[id]);
 async function as(i){await db.exec('reset role');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[ids[i]]);await db.exec('set role authenticated');}
 async function rpc(n,a=[]){return(await db.query(`select public.${n}(${a.map((_,i)=>'$'+(i+1)).join(',')}) as r`,a)).rows[0].r;}
 return {db,ids,as,rpc};
}
