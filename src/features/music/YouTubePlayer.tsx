import {useEffect,useRef,useState} from 'react';
export type Player={destroy:()=>void;seekTo:(seconds:number,allowSeekAhead:boolean)=>void;playVideo:()=>void;pauseVideo:()=>void;getCurrentTime:()=>number;getPlayerState:()=>number;getPlaylist:()=>string[];getPlaylistIndex:()=>number;getVideoData:()=>{video_id:string};playVideoAt:(index:number)=>void;cuePlaylist:(options:{list:string;listType:string;index:number;startSeconds:number})=>void};
type YTApi={Player:new(node:HTMLElement,options:Record<string,unknown>)=>Player};
declare global{interface Window{YT?:YTApi;onYouTubeIframeAPIReady?:()=>void;}}
let ready:Promise<YTApi>|undefined;
export function loadAPI(){if(window.YT?.Player)return Promise.resolve(window.YT);return ready??=new Promise<YTApi>((resolve,reject)=>{const prior=window.onYouTubeIframeAPIReady;const timer=setTimeout(()=>{ready=undefined;reject(Error('YouTube did not load.'));},15000);window.onYouTubeIframeAPIReady=()=>{prior?.();clearTimeout(timer);resolve(window.YT!);};const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timer);ready=undefined;reject(Error('YouTube could not be reached.'));};document.head.append(script);});}
export function YouTubePlayer({videoId,playing,position,updatedAt,serverTime,host=false,onComplete}:{videoId:string;playing:boolean;position:number;updatedAt:string;serverTime:string;host?:boolean;onComplete?:()=>Promise<boolean>}){
 const container=useRef<HTMLDivElement>(null),player=useRef<Player|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 const latest=useRef({playing,host,onComplete});latest.current={playing,host,onComplete};
 const ended=useRef(false),attempted=useRef(false),pending=useRef(false),alive=useRef(false),generation=useRef(0);
 const [ending,setEnding]=useState(false),[completionFailed,setCompletionFailed]=useState(false);
 async function complete(){
  const state=latest.current;if(!alive.current||!ended.current||!state.host||!state.playing||!state.onComplete||attempted.current||pending.current)return;
  attempted.current=true;pending.current=true;const version=generation.current;
  try{const ok=await state.onComplete();if(alive.current&&generation.current===version)setCompletionFailed(!ok);}
  catch{if(alive.current&&generation.current===version)setCompletionFailed(true);}
  finally{if(generation.current===version)pending.current=false;}
 }
 useEffect(()=>{generation.current++;ended.current=false;attempted.current=false;pending.current=false;setEnding(false);setCompletionFailed(false);},[videoId,playing,position,updatedAt]);
 useEffect(()=>{if(ending)void complete();},[ending,host,playing]);
 useEffect(()=>{let live=true;alive.current=true;setLoaded(false);setError('');void loadAPI().then(api=>{if(!live||!container.current)return;const child=document.createElement('div');container.current.append(child);player.current=new api.Player(child,{videoId,width:'100%',height:240,playerVars:{origin:location.origin,playsinline:1,autoplay:0},events:{onStateChange:(event:{data:number})=>{if(live&&event.data===0){ended.current=true;setEnding(true);void complete();}},onReady:()=>{if(live)setLoaded(true);},onError:()=>{if(live)setError('This video cannot play here. Open it on YouTube or ask the host to skip.');},onAutoplayBlocked:()=>{if(live)setError('Your browser paused playback. Press Play in the video to enable it.');}}});}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;alive.current=false;generation.current++;player.current?.destroy();player.current=null;container.current?.replaceChildren();};},[videoId]);
 useEffect(()=>{if(!loaded||!player.current||ended.current)return;const p=player.current;const target=Math.max(0,position+(playing?Math.max(0,(Date.parse(serverTime)-Date.parse(updatedAt))/1000):0));try{if(Math.abs(p.getCurrentTime()-target)>3)p.seekTo(target,true);if(playing&&p.getPlayerState()!==1)p.playVideo();else if(!playing&&p.getPlayerState()!==2)p.pauseVideo();}catch{setError('Playback could not follow the host. Use the player controls to retry.');}},[loaded,playing,position,updatedAt,serverTime]);
 return <>{!loaded&&!error&&<p role="status" className="music-note"><span className="wait-orbit"/>Loading YouTube player…</p>}<div className="music-player" ref={container}/>{completionFailed&&host&&<><p role="status" className="music-note">Could not advance the queue. Retry or use Next item.</p><button onClick={()=>{attempted.current=false;setCompletionFailed(false);void complete();}}>Retry next track</button></>}{error&&<p role="status" className="music-note">{error}</p>}</>;
}
