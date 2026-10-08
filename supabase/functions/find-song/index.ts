import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {aiConfigured} from '../_shared/ai.ts';
import {searchSong} from '../_shared/song-search.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async req=>{
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(!aiConfigured())return reply({error:'Song search is not configured.'},503);
 const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const auth=await client.auth.getUser();if(auth.error||!auth.data.user?.email_confirmed_at)return reply({error:'Sign in required'},401);
 try{
  const text=await req.text();if(text.length>2048)return reply({error:'Search is too long.'},400);
  const {groupId,clientId,query,country='MY'}=JSON.parse(text);
  if(typeof query!=='string'||!query.trim()||query.length>500||!['MY','US','GB','AU','SG','IN'].includes(country))return reply({error:'Enter a song description of up to 500 characters.'},400);
  const reserved=await client.rpc('request_ai_job',{p_group_id:groupId,p_kind:'song',p_client_id:clientId});if(reserved.error)return reply({error:reserved.error.message==='AI_DISABLED'?'The group owner must enable group AI first.':reserved.error.message==='AI_LIMIT'?'Your group AI request limit has been reached. Try tomorrow.':'Unable to search in this group.'},400);
  const prior=await client.from('ai_jobs').select('kind').eq('id',reserved.data).single();if(prior.error||prior.data.kind!=='song')return reply({error:'Invalid search retry.'},400);
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}}),claimed=await service.rpc('claim_ai_job',{p_job_id:reserved.data});if(claimed.error)return reply({error:'Could not start song search.'},503);
  if(claimed.data){try{const result=await searchSong(query,country,Deno.env.get('OPENROUTER_API_KEY')!,fetch,Deno.env.get('OPENROUTER_MODEL'),Deno.env.get('OPENROUTER_FALLBACK_MODEL'));const completed=await service.rpc('complete_ai_job',{p_job_id:reserved.data,p_state:'done',p_result:JSON.stringify(result),p_sources:[],p_partial:false});if(completed.error)throw completed.error;}catch(error){const reason=error instanceof Error?error.message:'';const message=reason==='Song search rate limited'?'The selected free AI model is busy or rate-limited. Try again later, or paste a song link into the music box.':reason==='Music catalog unavailable'?'The music catalog is unavailable. Try again later.':reason==='Song search AI unavailable'?'The free AI provider is unavailable. Try again later or paste a link.':reason==='No search terms'||reason==='Invalid search terms'||error instanceof SyntaxError?'AI could not identify the song. Try a title and artist.':'Song search could not finish. Try again later or paste a music link.';await service.rpc('complete_ai_job',{p_job_id:reserved.data,p_state:'failed',p_result:message,p_sources:[],p_partial:false});}}
  const saved=await client.from('ai_jobs').select('state,result').eq('id',reserved.data).single();if(saved.error)return reply({error:'Search is no longer available.'},403);
  return reply({jobId:reserved.data,state:saved.data.state,...(saved.data.state==='done'?JSON.parse(saved.data.result):{error:saved.data.state==='failed'?saved.data.result:'Search is still running. Try the same search again shortly.'})});
 }catch{return reply({error:'Unable to process the song search.'},400);}
});
