import {useEffect,useRef,useState} from 'react';

type Playback={isPaused:boolean;isBuffering:boolean;duration:number;position:number;playingURI:string};
type Controller={play:()=>void;pause:()=>void;seek:(seconds:number)=>void;destroy:()=>void;addListener:(name:string,callback:(event:{data:Playback})=>void)=>void};
type SpotifyAPI={createController:(node:HTMLElement,options:Record<string,unknown>,callback:(controller:Controller)=>void)=>void};
declare global{interface Window{onSpotifyIframeApiReady?:(api:SpotifyAPI)=>void;}}
let apiReady:Promise<SpotifyAPI>|undefined;
function loadAPI(){
 return apiReady??=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const timeout=setTimeout(()=>{apiReady=undefined;script.remove();reject(Error('Spotify did not load. Rejoin listening to retry.'));},15000);
  window.onSpotifyIframeApiReady=api=>{clearTimeout(timeout);resolve(api);};
  script.src='https://open.spotify.com/embed/iframe-api/v1';
  script.onerror=()=>{clearTimeout(timeout);apiReady=undefined;script.remove();reject(Error('Spotify could not be reached. Rejoin listening to retry.'));};
  document.head.append(script);
 });
}

export function SpotifyPlayer({trackId,playing,position,updatedAt,serverTime}:{trackId:string;playing:boolean;position:number;updatedAt:string;serverTime:string}){
 const container=useRef<HTMLDivElement>(null),controller=useRef<Controller|null>(null);
 const playback=useRef<Playback|null>(null),observedAt=useRef(0),playRequested=useRef(false),lastCommand=useRef('');
 const [ready,setReady]=useState(false),[duration,setDuration]=useState(0),[ended,setEnded]=useState(false),[error,setError]=useState('');
 const command=`${trackId}:${updatedAt}:${playing}:${position}`;
 const target=Math.max(0,position+(playing?Math.max(0,(Date.parse(serverTime)-Date.parse(updatedAt))/1000):0));
 useEffect(()=>{
  let live=true,owned:Controller|null=null;
  setReady(false);setDuration(0);setEnded(false);setError('');playback.current=null;playRequested.current=false;lastCommand.current='';
  void loadAPI().then(api=>{
   if(!live||!container.current)return;
   const child=document.createElement('div');container.current.append(child);
   api.createController(child,{uri:`spotify:track:${trackId}`,width:'100%',height:352},p=>{
    if(!live){p.destroy();return;}
    owned=p;controller.current=p;
    p.addListener('ready',()=>{if(live)setReady(true);});
    p.addListener('playback_update',event=>{
     if(!live||event.data.playingURI!==`spotify:track:${trackId}`)return;
     playback.current=event.data;observedAt.current=performance.now();
     if(Number.isFinite(event.data.duration)&&event.data.duration>0)setDuration(event.data.duration/1000);
     if(event.data.isPaused&&event.data.duration>0&&event.data.position>=event.data.duration-150)setEnded(true);
    });
   });
  }).catch(e=>{if(live)setError(e.message);});
  return()=>{live=false;owned?.destroy();if(controller.current===owned)controller.current=null;container.current?.replaceChildren();};
 },[trackId]);

 useEffect(()=>{
  const p=controller.current;if(!ready||!p)return;
  const changed=lastCommand.current!==command;
  if(changed){lastCommand.current=command;playRequested.current=false;setEnded(false);}
  const state=playback.current;
  // A listener may receive only a preview. Never restart it in a polling loop
  // or let that local limit advance the shared queue for other listeners.
  if((duration>0&&target>=duration)||(ended&&!changed)){
   if(state&&!state.isPaused)p.pause();setEnded(true);return;
  }
  try{
   const observed=state?state.position/1000+(!state.isPaused&&!state.isBuffering?(performance.now()-observedAt.current)/1000:0):0;
   if(duration>0&&Math.abs(observed-target)>3&&!state?.isBuffering)p.seek(Math.floor(target));
   if(playing&&state?.isPaused!==false&&!playRequested.current){playRequested.current=true;p.play();}
   else if(!playing&&state?.isPaused===false)p.pause();
  }catch{setError('Playback could not follow the host. Try enabling audio below.');}
 },[ready,command,playing,target,duration,ended]);

 return <><div className="music-player spotify-player" ref={container}/>
  <p className="music-note">Spotify controls availability and may provide a short preview. {duration>0?`Available playback on this device: ${Math.ceil(duration)} seconds.`:''} Full listening may require opening Spotify.</p>
  {ended?<p role="status" className="music-note">Your available playback has ended. The shared song stays in place; the host can seek back or choose the next item.</p>:ready&&playing&&<button type="button" onClick={()=>{try{if(duration>0)controller.current?.seek(Math.floor(Math.min(target,duration)));controller.current?.play();setError('');}catch{setError('Use the Spotify player or open the track on Spotify.');}}}>Enable Spotify audio on this device</button>}
  {error&&<p className="music-note" role="status">{error}</p>}
 </>;
}
