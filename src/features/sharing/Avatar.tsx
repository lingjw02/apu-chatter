import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
export function Avatar({path,name}:{path?:string|null;name:string}){
 const [source,setSource]=useState<{path:string;url:string}|null>(null);
 useEffect(()=>{let live=true,url='';setSource(null);if(path)void supabase!.storage.from('profile-avatars').download(path).then(r=>{if(!live||r.error||!r.data)return;url=URL.createObjectURL(r.data);setSource({path,url});});return()=>{live=false;if(url)URL.revokeObjectURL(url);};},[path]);
 return source&&source.path===path?<img className="profile-avatar-image" src={source.url} alt=""/>:<>{name[0]||'M'}</>;
}
export async function prepareAvatar(file:File):Promise<Blob>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Choose a JPEG, PNG or WebP image under 20 MB.');
 const bitmap=await createImageBitmap(file);try{const size=Math.min(bitmap.width,bitmap.height),canvas=document.createElement('canvas');canvas.width=384;canvas.height=384;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,384,384);ctx.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,384,384);
 for(const quality of [.85,.65,.4]){const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=262144)return blob;}throw Error('Try a smaller image.');}finally{bitmap.close();}
}
