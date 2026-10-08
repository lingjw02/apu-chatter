import {useEffect,useRef,useState} from 'react';
import {loadAPI} from './YouTubePlayer';
import type {Player} from './YouTubePlayer';
type Selection={index:number;video_id:string;position:number};
type Props={playlistId:string;videoId:string|null;playlistIndex:number;host:boolean;playing:boolean;position:number;updatedAt:string;serverTime:string;onTrack:(selection:Selection)=>Promise<boolean>;onComplete:()=>Promise<boolean>};

export function YouTubePlaylistPlayer(props:Props){
 const container=useRef<HTMLDivElement>(null),player=useRef<Player|null>(null),step=useRef(()=>{});
 const latest=useRef({...props,receivedAt:performance.now()});latest.current={...props,receivedAt:latest.current.serverTime===props.serverTime?latest.current.receivedAt:performance.now()};
 const [status,setStatus]=useState('Loading playlist…'),[count,setCount]=useState(0),[index,setIndex]=useState(0),[pending,setPending]=useState(false),[failed,setFailed]=useState(false),[providerFailed,setProviderFailed]=useState(false);
 const retry=useRef(()=>{});
 const navigate=useRef((_index:number)=>{});
 const retryPlayback=useRef(()=>{}),activate=useRef(()=>{});
 useEffect(()=>{
  let live=true,ready=false,inFlight=false,failed=false,aligned=false,applying='',appliedAt=0,lastServerVideo:string|null=null,ending=false,providerFailure:string|null=null,autoplayBlocked=false;
  setStatus('Loading playlist…');setCount(0);setIndex(0);setPending(false);setFailed(false);setProviderFailed(false);
  async function submit(selection:Selection|null){
   if(!live||inFlight||failed||!latest.current.host)return;
   inFlight=true;setPending(true);
   try{const ok=selection?await latest.current.onTrack(selection):await latest.current.onComplete();if(live&&!ok){failed=true;setFailed(true);setStatus('Could not share this playlist change. Retry to follow the room again.');}}
   catch{if(live){failed=true;setFailed(true);setStatus('Could not share this playlist change. Retry to follow the room again.');}}
   finally{inFlight=false;if(live)setPending(false);}
  }
  function tick(){
   const p=player.current;if(!live||!ready||!p||inFlight)return;
   const state=latest.current;
   try{
    const list=p.getPlaylist()||[],currentIndex=p.getPlaylistIndex(),currentVideo=p.getVideoData()?.video_id||list[currentIndex];
    setCount(list.length);setIndex(Math.max(0,currentIndex));
    if(!list.length){setStatus('This playlist has not exposed any playable tracks yet. You can open it on YouTube.');return;}
    if(state.videoId!==lastServerVideo){lastServerVideo=state.videoId;aligned=false;applying='';failed=false;setFailed(false);ending=false;if(providerFailure&&state.videoId!==providerFailure){providerFailure=null;setProviderFailed(false);}}
    if(failed)return;
    if(providerFailure&&(currentVideo===providerFailure||applying===providerFailure)&&(!state.videoId||state.videoId===providerFailure)){setStatus('YouTube cannot play this track here. Ask the host to choose another track.');return;}
    if(applying){if(currentVideo===applying){applying='';aligned=true;}else if(performance.now()-appliedAt<5000)return;else{setStatus('This track could not load on your device. Open YouTube or ask the host to choose another track.');return;}}
    if(!state.videoId){
     if(state.host&&/^[\w-]{11}$/.test(currentVideo||'')){aligned=true;void submit({index:currentIndex,video_id:currentVideo,position:Math.max(0,p.getCurrentTime())});}
     else setStatus('Waiting for the host to choose a playlist track.');
     return;
    }
    if(currentVideo===state.videoId)aligned=true;
    if(currentVideo!==state.videoId){
     if(state.host&&aligned){if(/^[\w-]{11}$/.test(currentVideo||''))void submit({index:currentIndex,video_id:currentVideo,position:Math.max(0,p.getCurrentTime())});return;}
     const desired=list[state.playlistIndex]===state.videoId?state.playlistIndex:list.indexOf(state.videoId);
     if(desired<0){p.pauseVideo();setStatus('The host’s track is unavailable in this playlist on your device. Waiting for the next track.');return;}
     applying=state.videoId;appliedAt=performance.now();
     p.cuePlaylist({list:state.playlistId,listType:'playlist',index:desired,startSeconds:state.position});return;
    }
    if(p.getPlayerState()===0){
     if(state.host&&state.playing&&currentIndex===list.length-1&&!ending){ending=true;void submit(null);}
     return;
    }
    if(autoplayBlocked){setStatus(state.playing?'Press Enable playlist audio to allow playback on this device.':'');return;}
    const target=Math.max(0,state.position+(state.playing?Math.max(0,(Date.parse(state.serverTime)-Date.parse(state.updatedAt))/1000)+(performance.now()-state.receivedAt)/1000:0));
    if(Math.abs(p.getCurrentTime()-target)>3)p.seekTo(target,true);
    if(state.playing&&p.getPlayerState()!==1&&p.getPlayerState()!==3)p.playVideo();
    else if(!state.playing&&p.getPlayerState()===1)p.pauseVideo();
    setStatus('');
   }catch{setStatus('Playlist playback is unavailable. Open YouTube or rejoin listening to retry.');}
  }
  step.current=tick;retry.current=()=>{failed=false;ending=false;applying='';aligned=false;setFailed(false);setStatus('');tick();};
  navigate.current=next=>{const p=player.current;if(!live||!ready||!p||inFlight||failed||!latest.current.host)return;lastServerVideo=latest.current.videoId;aligned=true;applying='';ending=false;p.playVideoAt(next);};
  activate.current=()=>{if(!live||providerFailure||failed)return;autoplayBlocked=false;player.current?.playVideo();tick();};
  retryPlayback.current=()=>{const p=player.current;if(!live||!ready||!p)return;providerFailure=null;setProviderFailed(false);setStatus('');const desired=latest.current.videoId?(p.getPlaylist()||[]).indexOf(latest.current.videoId):p.getPlaylistIndex();if(desired>=0){applying=latest.current.videoId||'';appliedAt=performance.now();p.cuePlaylist({list:latest.current.playlistId,listType:'playlist',index:desired,startSeconds:latest.current.position});}tick();};
  void loadAPI().then(api=>{
   if(!live||!container.current)return;const node=document.createElement('div');container.current.append(node);
   player.current=new api.Player(node,{width:'100%',height:280,playerVars:{origin:location.origin,playsinline:1,listType:'playlist',list:props.playlistId,autoplay:0},events:{onReady:()=>{ready=true;tick();},onStateChange:(event:{data:number})=>{if(event.data===1)autoplayBlocked=false;tick();},onError:()=>{if(live){providerFailure=applying||player.current?.getVideoData()?.video_id||latest.current.videoId||'';setProviderFailed(true);setStatus('YouTube cannot play this track here. Ask the host to choose another track.');}},onAutoplayBlocked:()=>{if(live){autoplayBlocked=true;setStatus('Press Enable playlist audio to allow playback on this device.');}}}});
  }).catch(e=>{if(live)setStatus(e.message);});
  const timer=setInterval(tick,750);
  return()=>{live=false;clearInterval(timer);player.current?.destroy();player.current=null;container.current?.replaceChildren();};
 },[props.playlistId]);
 useEffect(()=>{step.current();},[props.videoId,props.host,props.playing,props.position,props.updatedAt,props.serverTime]);
 return <><div className="music-player" ref={container}/>{count>0&&<p className="music-note">Playlist track {index+1} of {count}</p>}
  {props.host&&<div className="music-session-controls"><button disabled={pending||failed||index<=0} onClick={()=>navigate.current(index-1)}>Previous playlist track</button><button disabled={pending||failed||!count||index>=count-1} onClick={()=>navigate.current(index+1)}>Next playlist track</button></div>}
  {props.playing&&<button disabled={providerFailed||failed} onClick={()=>activate.current()}>Enable playlist audio</button>}
  {providerFailed&&<button onClick={()=>retryPlayback.current()}>Retry playlist playback</button>}
  {status&&<p className="music-note" role="status">{status}</p>}{failed&&<button onClick={()=>retry.current()}>Retry playlist sync</button>}
 </>;
}
