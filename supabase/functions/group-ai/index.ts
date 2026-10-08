import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { aiConfigured,performJob } from '../_shared/ai.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async(req)=>{
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(!aiConfigured())return reply({error:'AI is not configured yet. The operator must add an OpenRouter key and free model.'},503);
 const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const auth=await client.auth.getUser();if(auth.error||!auth.data.user?.email_confirmed_at)return reply({error:'Sign in required'},401);
 try{const {groupId,kind,clientId,rangeStart,rangeEnd}=await req.json();if(!['summary','decisions','notes'].includes(kind))return reply({error:'Invalid request'},400);
 const ranged=rangeStart!==undefined||rangeEnd!==undefined;
 const reserved=ranged?await client.rpc('request_ai_job_range',{p_group_id:groupId,p_kind:kind,p_client_id:clientId,p_start:rangeStart,p_end:rangeEnd}):await client.rpc('request_ai_job',{p_group_id:groupId,p_kind:kind,p_client_id:clientId});if(reserved.error)return reply({error:reserved.error.message},400);
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});const claimed=await service.rpc('claim_ai_job',{p_job_id:reserved.data});if(claimed.error)return reply({error:'Could not start AI'},503);
 if(claimed.data)await performJob(service,claimed.data);return reply({jobId:reserved.data});
 }catch{return reply({error:'Unable to process this request'},400);}
});
