import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {YouTubePlaylistPlayer} from '../../src/features/music/YouTubePlaylistPlayer';
function Check(){
 const [session,setSession]=useState({videoId:null as string|null,playlistIndex:0,position:0,playing:false,updatedAt:new Date().toISOString()}),[now,setNow]=useState(new Date().toISOString());
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date().toISOString()),1000);return()=>clearInterval(timer);},[]);
 return <main style={{fontFamily:'system-ui',padding:20}}><h1>Real YouTube playlist components</h1><button onClick={()=>{const time=new Date().toISOString();setSession(s=>({...s,playing:!s.playing,updatedAt:time,position:0}));setNow(time);}}>{session.playing?'Pause together':'Play together'}</button><button onClick={()=>{const duration=(window as unknown as {__playlistPlayers:{getDuration:()=>number}[]}).__playlistPlayers[0].getDuration(),time=new Date().toISOString();setSession(s=>({...s,playing:true,position:duration-1,updatedAt:time}));setNow(time);}}>Finish current track</button>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>{[true,false].map(host=><section key={String(host)} aria-label={host?'Host':'Listener'}><h2>{host?'Host':'Listener'}</h2><YouTubePlaylistPlayer playlistId="PLUl4u3cNGP63EdVPNLG3ToM6LaEUuStEY" {...session} host={host} serverTime={now} onTrack={async selection=>{if(!host)throw Error('Follower attempted to publish');await new Promise(r=>setTimeout(r,150));const time=new Date().toISOString();setSession(s=>({...s,videoId:selection.video_id,playlistIndex:selection.index,position:selection.position,updatedAt:time}));setNow(time);return true;}} onComplete={async()=>true}/></section>)}</div></main>;
}
createRoot(document.getElementById('root')!).render(<Check/>);
