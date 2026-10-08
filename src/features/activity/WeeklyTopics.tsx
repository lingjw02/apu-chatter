import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
type Topic={label:string;sources:string[]};
type Week={week_start:string;partial:boolean;topics:Topic[]};
export function WeeklyTopics({groupId}:{groupId:string}){
 const [week,setWeek]=useState<Week|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [source,setSource]=useState(''),[reading,setReading]=useState(false);
 useEffect(()=>{
  let live=true,version=0;setWeek(null);setLoading(true);setSource('');
  async function load(){if(document.hidden)return;const run=++version;const r=await supabase!.rpc('group_weekly_topics',{p_group_id:groupId});if(!live||run!==version)return;setLoading(false);setSource('');if(r.error){setWeek(null);setError('Topics are unavailable. Check your connection or group access.');}else{setWeek(r.data);setError('');}}
  void load();const timer=setInterval(load,15000);window.addEventListener('focus',load);
  return()=>{live=false;version++;clearInterval(timer);window.removeEventListener('focus',load);};
 },[groupId]);
 async function read(id:string){setReading(true);setSource('');try{const r=await supabase!.from('group_messages').select('body,created_at').eq('group_id',groupId).eq('id',id).is('deleted_at',null).maybeSingle();setSource(r.error||!r.data?'This source message is no longer available.':new Date(r.data.created_at).toLocaleString()+'\n\n'+r.data.body);}finally{setReading(false);}}
 return <section className="weekly-topics"><h3>What we talked about</h3>{loading?<p role="status">Loading weekly topics…</p>:error?<p role="alert">{error}</p>:!week||!week.topics.length?<p>Topics appear after a weekly summary with group AI enabled. No request is made when you open Activity.</p>:<><p>Week of {week.week_start}</p><ol>{week.topics.map(t=><li key={t.label}><span>{t.label}</span><small>{t.sources.length} supporting {t.sources.length===1?'message':'messages'}</small><details><summary>Read supporting messages</summary><div className="topic-sources">{t.sources.map((id,i)=><button className="text-button" disabled={reading} key={id} onClick={()=>void read(id)}>Message {i+1}</button>)}</div></details></li>)}</ol><small>AI interpretation, ordered by supporting messages in the summary’s selected context. This is not a count of everyone’s interests.{week.partial?' Partial coverage: this week exceeded the input limit.':''}</small></>}{reading&&<p role="status">Loading source…</p>}{source&&<div className="topic-source" role="status"><p>{source}</p><button className="text-button" onClick={()=>setSource('')}>Close source</button></div>}</section>;
}
