import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
 const client=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const auth=await client.auth.getUser();if(auth.error||!auth.data.user?.email_confirmed_at)return reply({error:'Sign in required'},401);
 try{
 const {contentId}=await req.json();if(typeof contentId!=='string'||! /^[0-9a-f-]{36}$/i.test(contentId))return reply({error:'Invalid content'},400);
 const removed=await client.rpc('delete_content',{p_content_id:contentId});if(removed.error)return reply({error:'Content unavailable or permission denied'},403);
 if(removed.data){const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});const r=await service.storage.from('group-media').remove([removed.data]);if(r.error)return reply({error:'Content hidden; storage cleanup will be retried'},503);const confirmed=await client.rpc('confirm_media_removed',{p_content_id:contentId});if(confirmed.error)return reply({error:'Content hidden; quota reconciliation pending'},503);}
 return reply({deleted:true});
 }catch{return reply({error:'Unable to delete content'},400);}
});
