import { useEffect,useRef,useState } from 'react';
import { supabase } from '../../lib/supabase';
export type Content={id:string;group_id:string;author_id:string;kind:string;caption:string;mime:string|null;bytes:number;object_path:string|null;created_at:string;state:string};
export function MediaAsset({item,lazy=false}:{item:Content;lazy?:boolean}){
 const container=useRef<HTMLDivElement>(null),[ready,setReady]=useState(!lazy);
 useEffect(()=>{if(!lazy||!container.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setReady(true);observer.disconnect();}},{rootMargin:'200px'});observer.observe(container.current);return()=>observer.disconnect();},[lazy]);
 const [url,setUrl]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{let live=true,objectUrl='';setUrl('');setError(false);if(!ready||!item.object_path)return;void supabase!.storage.from('group-media').download(item.object_path).then(({data,error})=>{if(!live)return;if(error||!data){setError(true);return;}objectUrl=URL.createObjectURL(data);setUrl(objectUrl);});return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[item.object_path,ready]);
 if(!item.object_path)return null;return <div ref={container} className="media-asset" style={lazy?{minHeight:180}:undefined}>{error?<p>Media unavailable. Refresh to check your access.</p>:!url?<p role="status">{ready?'Loading media…':'Photo or video'}</p>:item.mime?.startsWith('audio/')?<audio src={url} controls preload="metadata" aria-label={item.caption||'Voice message'}/>:item.mime?.startsWith('video/')?<video src={url} controls preload="metadata" playsInline/>:<img src={url} alt={item.caption||'Shared group photo'}/>}</div>;
}
export async function prepareMedia(file:File):Promise<Blob>{
 if(file.type==='image/gif'){if(file.size>2097152)throw Error('GIFs must be at most 2 MB.');return file;}
 if(['image/jpeg','image/png','image/webp'].includes(file.type)){
  const bitmap=await createImageBitmap(file);const ratio=Math.min(1,2048/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const context=canvas.getContext('2d')!;context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  for(const quality of [.86,.7,.5]){const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=2097152)return blob;}throw Error('This image is too large. Please choose a smaller image.');
 }
 if(!['video/mp4','video/webm'].includes(file.type)||file.size>15728640)throw Error('Choose a JPEG, PNG, WebP, MP4 or WebM. Videos must be at most 15 MB.');
 await new Promise<void>((resolve,reject)=>{const url=URL.createObjectURL(file),video=document.createElement('video');const timer=setTimeout(()=>finish(Error('Could not read this video.')),10000);function finish(error?:Error){clearTimeout(timer);video.removeAttribute('src');video.load();URL.revokeObjectURL(url);error?reject(error):resolve();}video.preload='metadata';video.onloadedmetadata=()=>finish(Number.isFinite(video.duration)&&video.duration<=30?undefined:Error('Videos must be at most 30 seconds.'));video.onerror=()=>finish(Error('This video could not be opened.'));video.src=url;});return file;
}
export function ChatMedia({contentId}:{contentId:string}){
 const [item,setItem]=useState<Content|null>(null);
 useEffect(()=>{let live=true;void supabase!.from('group_content').select('*').eq('id',contentId).eq('state','live').maybeSingle().then(r=>{if(live)setItem(r.data);});return()=>{live=false;};},[contentId]);
 return item?<div className="chat-media-asset"><MediaAsset item={item}/></div>:null;
}
