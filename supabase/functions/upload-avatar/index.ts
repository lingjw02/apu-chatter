import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async(req)=>{
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const auth=await client.auth.getUser();if(auth.error||!auth.data.user?.email_confirmed_at)return reply({error:'Sign in required'},401);
 try{
  const reader=req.body?.getReader();if(!reader)return reply({error:'Choose an image'},400);const chunks:Uint8Array[]=[];let total=0;
  while(true){const next=await reader.read();if(next.done)break;total+=next.value.length;if(total>300000){await reader.cancel();return reply({error:'Avatar too large'},413);}chunks.push(next.value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const form=await new Response(bytes,{headers:{'Content-Type':req.headers.get('Content-Type')||''}}).formData(),file=form.get('file');
  if(!(file instanceof File)||file.size>262144||file.size===0)return reply({error:'Choose an image under 256 KB'},400);
  const head=new Uint8Array(await file.slice(0,16).arrayBuffer()),ascii=(a:number,b:number)=>String.fromCharCode(...head.slice(a,b));
  const detected=head[0]===255&&head[1]===216&&head[2]===255?'image/jpeg':head[0]===137&&ascii(1,4)==='PNG'?'image/png':ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'?'image/webp':null;
  if(!detected||detected!==file.type)return reply({error:'Choose a JPEG, PNG or WebP image'},400);
  const reserved=await client.rpc('reserve_avatar',{p_mime:file.type,p_bytes:file.size});if(reserved.error)return reply({error:'Avatar limit reached. Try again later.'},429);
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const upload=await service.storage.from('profile-avatars').upload(reserved.data.object_path,file,{contentType:file.type,upsert:false,cacheControl:'0'});
  if(upload.error)return reply({error:'Could not upload your avatar'},503);
  const published=await client.rpc('publish_avatar',{p_id:reserved.data.id});if(published.error){await service.storage.from('profile-avatars').remove([reserved.data.object_path]);return reply({error:'Avatar changed during upload. Please try again.'},409);}
  return reply({path:reserved.data.object_path});
 }catch{return reply({error:'Could not process this image'},400);}
});
