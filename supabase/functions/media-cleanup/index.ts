import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
Deno.serve(async(req)=>{
 const expected=Deno.env.get('MEDIA_CLEANUP_SECRET');
 if(req.method!=='POST'||!expected||req.headers.get('x-cleanup-secret')!==expected)return new Response('Unauthorized',{status:401});
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const batch=await client.rpc('media_cleanup_batch');if(batch.error)return new Response('Cleanup unavailable',{status:503});
 let removed=0;
 for(const item of batch.data||[]){const r=await client.storage.from('group-media').remove([item.object_path]);if(r.error)continue;const done=await client.rpc('finish_media_cleanup',{p_path:item.object_path});if(!done.error)removed++;}
 const avatars=await client.rpc('avatar_cleanup_batch');if(avatars.error)return new Response('Avatar cleanup unavailable',{status:503});
 for(const item of avatars.data||[]){const r=await client.storage.from('profile-avatars').remove([item.object_path]);if(r.error)continue;const done=await client.rpc('finish_avatar_cleanup',{p_path:item.object_path});if(!done.error)removed++;}
 return Response.json({removed});
});
