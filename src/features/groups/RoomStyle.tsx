import {useEffect,useState} from 'react';
import {Palette,Check} from '@phosphor-icons/react';
import {RoomPopover} from './RoomPopover';
import './room-style.css';
export type RoomLook={wallpaper:'ripple'|'confetti'|'plain';motion:boolean};
const initial:RoomLook={wallpaper:'ripple',motion:true};
function read(key:string):RoomLook{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&['ripple','confetti','plain'].includes(value.wallpaper)?{wallpaper:value.wallpaper,motion:value.motion!==false}:initial;}catch{return initial;}}
export function useRoomStyle(userId:string,groupId:string){
 const key='apu-room-style:'+userId+':'+groupId;
 const [saved,setSaved]=useState(()=>({key,look:read(key)}));
 const look=saved.key===key?saved.look:read(key);
 useEffect(()=>setSaved({key,look:read(key)}),[key]);
 function change(next:RoomLook){setSaved({key,look:next});try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Personal styles also work without storage. */}}
 return {look,change};
}
export function RoomStyle({look,onChange}:{look:RoomLook;onChange:(next:RoomLook)=>void}){
 const [open,setOpen]=useState(false);
 return <div className="room-style"><button className="style-launch" aria-label="Room style" title="Room style" aria-expanded={open} onClick={()=>setOpen(!open)}><Palette size={19} aria-hidden="true"/><span>Room style</span></button>{open&&<RoomPopover label="Room style" className="style-panel" onClose={()=>setOpen(false)}><h2>Make this corner yours.</h2><p>Choose a wallpaper for this group on your device.</p><div className="wallpaper-options">{(['ripple','confetti','plain'] as const).map(value=><button key={value} aria-label={value[0].toUpperCase()+value.slice(1)+' wallpaper'} aria-pressed={look.wallpaper===value} onClick={()=>onChange({...look,wallpaper:value})}><span className={'wallpaper-swatch swatch-'+value}/><span>{value[0].toUpperCase()+value.slice(1)}{look.wallpaper===value&&<Check aria-hidden="true"/>}</span></button>)}</div><button className="pointer-toggle" aria-label="Pointer response" aria-pressed={look.motion} onClick={()=>onChange({...look,motion:!look.motion})}><span><strong>Pointer response</strong><small>A little light follows your cursor.</small></span><span className={'style-switch '+(look.motion?'on':'')}/></button><p className="style-footnote">Respects your device’s reduced-motion setting. Your choice stays private.</p></RoomPopover>}</div>;
}
