import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SpotifyPlayer} from '../../src/features/music/SpotifyPlayer';
function Check(){
 const [state,setState]=useState({playing:false,position:0,updatedAt:new Date().toISOString()}),[now,setNow]=useState(new Date().toISOString());
 useEffect(()=>{const t=setInterval(()=>setNow(new Date().toISOString()),1000);return()=>clearInterval(t);},[]);
 function update(playing:boolean,position:number){const time=new Date().toISOString();setState({playing,position,updatedAt:time});setNow(time);}
 return <main style={{maxWidth:1100,margin:24,fontFamily:'system-ui'}}><h1>Real Spotify shared component check</h1>
  <button onClick={()=>update(true,state.position)}>Play together</button>
  <button onClick={()=>update(false,state.position+(state.playing?(Date.now()-Date.parse(state.updatedAt))/1000:0))}>Pause together</button>
  <button onClick={()=>update(state.playing,10)}>Seek together</button>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>{['Host','Listener'].map(name=><section key={name}><h2>{name}</h2><SpotifyPlayer trackId="2Foc5Q5nqNiosCNqttzHof" {...state} serverTime={now}/></section>)}</div>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Check/>);
