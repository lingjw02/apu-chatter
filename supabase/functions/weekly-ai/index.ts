import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { aiConfigured,performJob } from '../_shared/ai.ts';
Deno.serve(async(req)=>{
 const secret=Deno.env.get('MEDIA_CLEANUP_SECRET');if(req.method!=='POST'||!secret||req.headers.get('x-cleanup-secret')!==secret)return new Response('Unauthorized',{status:401});
 if(!aiConfigured())return Response.json({skipped:'AI not configured'});
 const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});const jobs=await service.rpc('claim_weekly_ai');if(jobs.error)return new Response('Jobs unavailable',{status:503});
 await Promise.all((jobs.data||[]).map((job:any)=>performJob(service,job)));return Response.json({processed:jobs.data?.length||0});
});
