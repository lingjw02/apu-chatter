import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChatCircle, LockSimple, PaperPlaneTilt, X } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import { Sheet } from '../groups/Sheet';
import './private.css';

type Chat = { id:string; requester_id:string; recipient_id:string; state:'pending'|'open'|'closed'; expires_at:string };
type Message = { id:string; author_id:string; body:string; created_at:string };
type Person = { id:string; display_name:string };
const failure = (e:unknown) => {
 const message = e && typeof e==='object' && 'message' in e ? String(e.message) : '';
 if(message.includes('CHAT_CLOSED')) return 'This chat has ended or the request expired.';
 if(message.includes('RATE_LIMITED')) return 'A little too fast. Please wait before trying again.';
 if(message.includes('NOT_MEMBER')||message.includes('FORBIDDEN')) return 'This conversation is no longer available.';
 return 'Could not connect. Please try again.';
};
export function PrivateChats({groupId,userId}:{groupId:string;userId:string}) {
 const client=supabase!;
 const [visible,setVisible]=useState(false),[chats,setChats]=useState<Chat[]>([]),[people,setPeople]=useState<Person[]>([]);
 const [selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 const alive=useRef(true),generation=useRef(0);
 async function refresh(){
  const version=++generation.current;
  const [chatResult,members]=await Promise.all([client.from('private_chats').select('id,requester_id,recipient_id,state,expires_at').eq('group_id',groupId).neq('state','closed').order('created_at'),client.from('memberships').select('user_id').eq('group_id',groupId)]);
  if(chatResult.error)throw chatResult.error;if(members.error)throw members.error;
  const ids=(members.data||[]).map(m=>m.user_id);
  const profiles=ids.length?await client.from('profiles').select('id,display_name').in('id',ids):{data:[],error:null};
  if(profiles.error)throw profiles.error;
  if(!alive.current||version!==generation.current)return;
  setChats((chatResult.data||[]).filter(c=>c.state==='open'||Date.parse(c.expires_at)>Date.now()));
  setPeople(profiles.data||[]);setReady(true);
 }
 useEffect(()=>{
  alive.current=true;
  const run=()=>{if(document.hidden)return;void refresh().catch(()=>{if(alive.current){setChats([]);setError('Could not refresh private chats. Try again.');}});};
  run();const timer=setInterval(run,5000);
  const channel=client.channel(`private-list:${groupId}`).on('postgres_changes',{event:'*',schema:'public',table:'private_chats',filter:`group_id=eq.${groupId}`},run).subscribe();
  window.addEventListener('focus',run);window.addEventListener('online',run);
  return()=>{alive.current=false;generation.current++;clearInterval(timer);window.removeEventListener('focus',run);window.removeEventListener('online',run);void client.removeChannel(channel);};
 },[groupId,userId]);
 async function act(work:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await work();await refresh();}catch(e){if(alive.current)setError(failure(e));}finally{if(alive.current)setBusy(false);}}
 const incoming=chats.filter(c=>c.state==='pending'&&c.recipient_id===userId).length;
 const other=(c:Chat)=>c.requester_id===userId?c.recipient_id:c.requester_id;
 const name=(id:string)=>people.find(p=>p.id===id)?.display_name||'Member';
 return <>
  <div className="private-entry"><button title="Private chats" className="text-button" onClick={()=>{setVisible(true);void refresh().catch(()=>setError('Could not load conversations.'));}}><LockSimple size={16}/> Private chats {incoming>0&&<span className="request-count">{incoming} new</span>}</button><span>Just between two people.</span></div>
  {visible&&<Sheet label="Private chats" onClose={()=>{setVisible(false);setSelected('');}}>
   <button className="modal-close icon-btn" aria-label="Close private chats panel" onClick={()=>{setVisible(false);setSelected('');}}><X/></button>
   {selected?<PrivateConversation key={selected} chatId={selected} userId={userId} person={name(other(chats.find(c=>c.id===selected)||{requester_id:userId,recipient_id:''} as Chat))} onBack={()=>{setSelected('');void refresh().catch(()=>{});}}/>:<div className="private-lobby">
    <LockSimple size={25}/><h2>A little side conversation.</h2><p>Send a request to someone in this group. Text only, and deleted when either of you ends it.</p>
    {error&&<p role="alert" className="auth-error">{error}</p>}
    {!ready?<p role="status">Loading conversations…</p>:<>
     {chats.length>0&&<h3>Your conversations</h3>}
     {chats.map(c=><div className="private-person" key={c.id}><span className="avatar">{name(other(c))[0]}</span><div><strong>{name(other(c))}</strong><small>{c.state==='open'?'Ready to chat':c.recipient_id===userId?'Wants to chat with you':'Waiting for acceptance'}</small></div>
      {c.state==='open'?<button className="text-button" onClick={()=>setSelected(c.id)}>Open</button>:c.recipient_id===userId?<div className="private-actions"><button className="text-button" disabled={busy} onClick={()=>act(async()=>{const r=await client.rpc('respond_private_chat',{p_chat_id:c.id,p_accept:true});if(r.error)throw r.error;setSelected(c.id);})}>Accept</button><button className="text-button" disabled={busy} onClick={()=>act(async()=>{const r=await client.rpc('respond_private_chat',{p_chat_id:c.id,p_accept:false});if(r.error)throw r.error;})}>Decline</button></div>:<button className="text-button" disabled={busy} onClick={()=>act(async()=>{const r=await client.rpc('close_private_chat',{p_chat_id:c.id});if(r.error)throw r.error;})}>Cancel</button>}
     </div>)}
     <h3>Start a conversation</h3>
     {people.filter(p=>p.id!==userId&&!chats.some(c=>other(c)===p.id)).map(p=><div className="private-person" key={p.id}><span className="avatar">{p.display_name[0]}</span><strong>{p.display_name}</strong><button className="text-button" disabled={busy} onClick={()=>act(async()=>{const r=await client.rpc('request_private_chat',{p_group_id:groupId,p_recipient_id:p.id});if(r.error)throw r.error;})}>Request chat<span className="sr-only"> with {p.display_name}</span></button></div>)}
     {people.length<2&&<p>Invite someone to your group to start a private conversation.</p>}
     <p className="private-note">Unanswered requests expire after 24 hours. Closing this panel keeps an accepted chat open.</p>
    </>}
   </div>}
  </Sheet>}
 </>;
}
function PrivateConversation({chatId,userId,person,onBack}:{chatId:string;userId:string;person:string;onBack:()=>void}) {
 const client=supabase!;
 const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[status,setStatus]=useState<'loading'|'open'|'closed'|'error'>('loading');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
 const [more,setMore]=useState(false),[paging,setPaging]=useState(false);const loaded=useRef<Message[]>([]),preserveScroll=useRef(false);
 const alive=useRef(true),sequence=useRef(0),pending=useRef<{id:string;body:string}|null>(null),end=useRef<HTMLDivElement>(null);
 async function refresh(append=false){
  const version=++sequence.current;
  let query=client.from('private_messages').select('id,author_id,body,created_at').eq('chat_id',chatId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
  if(append&&loaded.current.length){const first=loaded.current[0];query=query.or(`created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`);}
  const rows=await query;
  if(rows.error)throw rows.error;
  // Recheck authorization/state after the content fetch; never display a stale closure payload.
  const current=await client.from('private_chats').select('state').eq('id',chatId).maybeSingle();
  if(current.error)throw current.error;
  if(!alive.current||version!==sequence.current)return;
  if(current.data?.state!=='open'){loaded.current=[];setMessages([]);setDraft('');pending.current=null;setStatus('closed');return;}
  const incoming=(rows.data||[]).reverse(),existing=loaded.current;const oldest=incoming[0],latest=existing[existing.length-1];const gap=!append&&incoming.length===100&&latest&&oldest&&(oldest.created_at>latest.created_at||(oldest.created_at===latest.created_at&&oldest.id>latest.id));
  const combined=new Map((gap?[]:existing).map(m=>[m.id,m]));incoming.forEach(m=>combined.set(m.id,m));const next=[...combined.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));loaded.current=next;setMessages(next);if(append||!existing.length||gap||(oldest&&existing[0]&&(oldest.created_at<existing[0].created_at||(oldest.created_at===existing[0].created_at&&oldest.id<existing[0].id))))setMore(incoming.length===100);setStatus('open');
 }
 useEffect(()=>{
  alive.current=true;
  const run=()=>{if(document.hidden){sequence.current++;loaded.current=[];setMessages([]);setStatus('loading');return;}void refresh().catch(()=>{if(alive.current){loaded.current=[];setMessages([]);setStatus('error');setError('Connection interrupted. Reconnect to view this chat.');}});};
  run();const timer=setInterval(run,3000);
  const channel=client.channel(`private-chat:${chatId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'private_messages',filter:`chat_id=eq.${chatId}`},run).on('postgres_changes',{event:'UPDATE',schema:'public',table:'private_chats',filter:`id=eq.${chatId}`},()=>{sequence.current++;loaded.current=[];setMessages([]);run();}).subscribe();
  window.addEventListener('focus',run);window.addEventListener('online',run);document.addEventListener('visibilitychange',run);
  return()=>{alive.current=false;sequence.current++;clearInterval(timer);window.removeEventListener('focus',run);window.removeEventListener('online',run);document.removeEventListener('visibilitychange',run);void client.removeChannel(channel);};
 },[chatId,userId]);
 useEffect(()=>{if(preserveScroll.current){preserveScroll.current=false;return;}end.current?.scrollIntoView({block:'nearest',behavior:'instant'});},[messages.length]);
 async function send(e:React.FormEvent){
  e.preventDefault();if(busy||!draft.trim()||status!=='open')return;
  const body=draft.trim();if(!pending.current||pending.current.body!==body)pending.current={id:crypto.randomUUID(),body};
  setBusy(true);setError('');try{const r=await client.rpc('send_private_message',{p_chat_id:chatId,p_client_id:pending.current.id,p_body:body});if(r.error)throw r.error;if(!alive.current)return;setDraft('');pending.current=null;await refresh();}catch(e){if(alive.current)setError(failure(e));}finally{if(alive.current)setBusy(false);}
 }
 async function finish(){setBusy(true);setError('');try{const r=await client.rpc('close_private_chat',{p_chat_id:chatId});if(r.error)throw r.error;if(alive.current){sequence.current++;loaded.current=[];setMessages([]);setDraft('');pending.current=null;setStatus('closed');setConfirm(false);}}catch(e){if(alive.current)setError(failure(e));}finally{if(alive.current)setBusy(false);}}
 return <div className="private-conversation"><button className="text-button" onClick={onBack}><ArrowLeft/> All private chats</button><h2>{person}</h2><p className="private-subtitle"><LockSimple size={14}/> Temporary · text only</p>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {status==='closed'?<div className="private-ended" role="status"><ChatCircle size={32}/><h3>This conversation has ended.</h3><p>Its messages have been deleted.</p><button className="text-button" onClick={onBack}>Back to private chats</button></div>:<>
   <div className="private-history" aria-label="Private messages" aria-live="polite">{status==='loading'?<p>Checking your conversation…</p>:status==='error'?<p>Messages are hidden until the connection is restored.</p>:!messages.length?<p>You’re both here. Say hello.</p>:messages.map(m=><div className={`private-message ${m.author_id===userId?'own':''}`} key={m.id}><span>{m.body}</span><time>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div>)}<div ref={end}/></div>
   {more&&status==='open'&&<button className="text-button" disabled={paging} onClick={async()=>{setPaging(true);preserveScroll.current=true;try{await refresh(true);}catch(e){setError(failure(e));}finally{setPaging(false);}}}>{paging?'Loading…':'Load earlier private messages'}</button>}
   <form className="private-composer" onSubmit={send}><input aria-label="Private message" placeholder="Just between you two…" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={4000} disabled={busy||status!=='open'}/><button className="send-btn" aria-label="Send private message" disabled={busy||status!=='open'||!draft.trim()}><PaperPlaneTilt/></button></form>
   {confirm?<div className="private-confirm"><strong>End and delete for both of you?</strong><p>This removes all text in this chat. You cannot undo it.</p><div><button className="danger-button" disabled={busy} onClick={finish}>End and delete</button><button className="text-button" disabled={busy} onClick={()=>setConfirm(false)}>Keep chatting</button></div></div>:<button className="text-button private-end" disabled={busy} onClick={()=>setConfirm(true)}>End conversation</button>}
  </>}
 </div>;
}
