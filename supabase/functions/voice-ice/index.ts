import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async req=>{
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in required'},401);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const auth=await client.auth.getUser();if(auth.error||!auth.data.user?.email_confirmed_at)return reply({error:'Sign in required'},401);
 try{const {sessionId}=await req.json();const member=await client.from('voice_members').select('session_id').eq('session_id',sessionId).eq('user_id',auth.data.user.id).gt('last_seen',new Date(Date.now()-45000).toISOString()).maybeSingle();if(member.error||!member.data)return reply({error:'Join voice first'},403);
 const key=Deno.env.get('CLOUDFLARE_TURN_KEY_ID'),token=Deno.env.get('CLOUDFLARE_TURN_API_TOKEN');
 if(!key||!token)return reply({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}],relayAvailable:false});
 const claim=await client.rpc('claim_voice_ice',{p_session_id:sessionId});if(claim.error)return reply({error:'Voice relay limit reached. Try later.'},429);
 const r=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(key)}/credentials/generate-ice-servers`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({ttl:3600}),signal:AbortSignal.timeout(10000)});if(!r.ok)return reply({error:'Voice relay is unavailable'},503);
 const data=await r.json();if(!data.iceServers)return reply({error:'Voice relay is unavailable'},503);return reply({iceServers:data.iceServers,relayAvailable:true,expiresIn:3600});
 }catch{return reply({error:'Could not configure voice'},400);}
});
