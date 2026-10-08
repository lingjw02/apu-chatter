import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { Input,BlobSource,MP4,WEBM } from 'npm:mediabunny@1.59.0';
import { validateVideoDuration } from '../_shared/video-validation.mjs';
import { validateAudioDuration } from '../_shared/audio-validation.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async(req)=>{
 const reply=(error:string,status:number)=>new Response(JSON.stringify({error}),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return reply('Method not allowed',405);
 const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply('Sign in required',401);
 const url=Deno.env.get('SUPABASE_URL')!;
 const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const auth=await client.auth.getUser();if(auth.error||!auth.data.user?.email_confirmed_at)return reply('Sign in required',401);
 try{
 // Bound the body while reading, including clients that omit Content-Length.
 const reader=req.body?.getReader();if(!reader)return reply('Missing file',400);
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>16*1024*1024){await reader.cancel();return reply('File too large',413);}chunks.push(next.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const form=await new Response(bytes,{headers:{'Content-Type':req.headers.get('Content-Type')||''}}).formData();
 const id=form.get('contentId'),file=form.get('file');if(typeof id!=='string'||!(file instanceof File))return reply('Invalid upload',400);
 const result=await client.from('group_content').select('id,author_id,object_path,mime,bytes,state,created_at').eq('id',id).single();const item=result.data;
 if(result.error||!item||item.author_id!==auth.data.user.id||item.state!=='reserved'||!item.object_path||Date.parse(item.created_at)<Date.now()-3600000)return reply('Upload unavailable',403);
 if(file.size!==item.bytes||file.type!==item.mime||file.size>15728640||(file.type.startsWith('image/')&&file.size>2097152))return reply('File does not match reservation',400);
 const head=new Uint8Array(await file.slice(0,16).arrayBuffer()),ascii=(a:number,b:number)=>String.fromCharCode(...head.slice(a,b));
 const detected=ascii(0,6)==='GIF87a'||ascii(0,6)==='GIF89a'?'image/gif':head[0]===255&&head[1]===216&&head[2]===255?'image/jpeg':head[0]===137&&ascii(1,4)==='PNG'?'image/png':ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'?'image/webp':ascii(4,8)==='ftyp'?(item.mime==='audio/mp4'?'audio/mp4':'video/mp4'):head[0]===26&&head[1]===69&&head[2]===223&&head[3]===163?(item.mime==='audio/webm'?'audio/webm':'video/webm'):null;
 if(detected!==item.mime)return reply('Unsupported file content',400);
 if(detected.startsWith('audio/')){if(file.size>5242880)return reply('Voice message too large',413);try{await validateAudioDuration(new Input({source:new BlobSource(file),formats:[MP4,WEBM]}));}catch{return reply('Choose audio no longer than 120 seconds.',400);}}
 if(detected.startsWith('video/')){try{await validateVideoDuration(new Input({source:new BlobSource(file),formats:[MP4,WEBM]}));}catch{return reply('Choose a valid video no longer than 30 seconds.',400);}}
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const upload=await service.storage.from('group-media').upload(item.object_path,file,{contentType:item.mime,upsert:false,cacheControl:'0'});
 if(upload.error)return reply('Upload failed; retry with a new reservation',409);
 // Client calls publish_media next; it rechecks current membership and object metadata.
 return new Response(JSON.stringify({uploaded:true}),{headers:{...cors,'Content-Type':'application/json'}});
 }catch{return reply('Unable to process this file',400);}
});
