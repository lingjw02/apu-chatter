import {useEffect,useState,useSyncExternalStore} from 'react';
let pending=0;const listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(fn=>fn());
export async function activityFetch(input:RequestInfo|URL,init?:RequestInit){pending++;notify();try{return await fetch(input,init);}finally{pending--;notify();}}
export function NetworkActivity(){
 const count=useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>pending);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setVisible(count>0),count?250:350);return()=>clearTimeout(timer);},[count>0]);
 return visible?<div className="network-activity" role="status" aria-live="polite"><span className="wait-orbit" aria-hidden="true"/>Working…<span className="network-track" aria-hidden="true"/></div>:null;
}
