import {MessageNotifications,notificationEligible,type MessageNotice} from './MessageNotifications';
import {RoomStyle,useRoomStyle} from './RoomStyle';
import {readNavigation,saveNavigation} from './navigation';
import { BlockedAccounts } from './BlockedAccounts';
import { refreshHasGap } from '../../lib/history-gap';
import { lazy,Suspense,useEffect,useRef,useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, ChatCircle, Check, Copy, GearSix, Link, PaperPlaneTilt, Plus, SignOut, UsersThree, X } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import './connected.css';
import { Sheet } from './Sheet';
import { GroupControls } from './GroupControls';
import { AIPanel } from '../ai/AIPanel';
import { BoardPanel } from '../board/BoardPanel';
import { Avatar,prepareAvatar } from '../sharing/Avatar';
import { ChatMedia } from '../sharing/media';
import { SharingPanel } from '../sharing/SharingPanel';
import { ActivityPanel } from '../activity/ActivityPanel';
import { PrivateChats } from '../private-chat/PrivateChats';
import { ThemeSettings } from '../personalization/ThemeSettings';
import { SoundSettings } from '../personalization/SoundSettings';
import { notifySender } from '../personalization/audio';
import { shouldNotify } from '../personalization/preferences';
import { QRCodeSVG } from 'qrcode.react';

const ComposerTools=lazy(()=>import('../composer/ComposerTools').then(m=>({default:m.ComposerTools})));
const VoiceRoom=lazy(()=>import('../voice/VoiceRoom').then(m=>({default:m.VoiceRoom})));
const MusicRoom=lazy(()=>import('../music/MusicRoom').then(m=>({default:m.MusicRoom})));
type Group={id:string;name:string;description:string;timezone:string};
type Profile={id:string;display_name:string;bio:string;status:string;avatar_path?:string|null};
type Message={id:string;author_id:string;body:string;created_at:string;client_id:string;deleted_at:string|null;content_id:string|null};
export function ConnectedApp({user}:{user:User}) {
 const client=supabase!;
 const attachmentSender=useRef<(()=>Promise<void>)|null>(null);const [hasAttachment,setHasAttachment]=useState(false),[attachmentBusy,setAttachmentBusy]=useState(false);
 const [musicDock,setMusicDock]=useState<HTMLDivElement|null>(null);
 const [updateAuthors,setUpdateAuthors]=useState<Record<string,boolean>>({}),[updateAuthor,setUpdateAuthor]=useState<string|undefined>(),[profileView,setProfileView]=useState<Profile|null>(null);
 const [memberIds,setMemberIds]=useState<string[]>([]);
 const [controls,setControls]=useState(false);
 const [view,setView]=useState<'chat'|'updates'|'albums'|'board'|'ai'>(()=>readNavigation(user.id).view);
 const [deleting,setDeleting]=useState<Message|null>(null);
 const loadedMessages=useRef<Message[]>([]);
 const messageLoads=useRef({tail:Promise.resolve()});
 const notificationGroups=useRef(new Set<string>());
 const [messageNotices,setMessageNotices]=useState<MessageNotice[]>([]);
 const notificationContext=useRef({groups:[] as Group[],profiles:{} as Record<string,Profile>,selected:'',view:''});
 const [groups,setGroups]=useState<Group[]>([]),[selected,setSelected]=useState(''),[messages,setMessages]=useState<Message[]>([]);
 useEffect(()=>{if(selected)saveNavigation(user.id,selected,view);},[user.id,selected,view]);
 const roomStyle=useRoomStyle(user.id,selected);
 const [profiles,setProfiles]=useState<Record<string,Profile>>({}),[me,setMe]=useState<Profile|null>(null);
 const [draft,setDraft]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [create,setCreate]=useState(false),[name,setName]=useState(''),[description,setDescription]=useState(''),[settings,setSettings]=useState(location.pathname==='/settings/profile');
 const [role,setRole]=useState('member'),[invite,setInvite]=useState<{invite_id:string;token:string}|null>(null),[members,setMembers]=useState(0),[mobileMenu,setMobileMenu]=useState(false);
 const [older,setOlder]=useState(false),[more,setMore]=useState(false);
 const active=useRef(''),request=useRef(0),historyStarted=useRef(false),pending=useRef<{group:string;body:string;id:string}|null>(null),end=useRef<HTMLDivElement>(null);
 useEffect(()=>{loadedMessages.current=messages;},[messages]);
 useEffect(()=>{notificationGroups.current=new Set(groups.map(g=>g.id));setMessageNotices(old=>old.filter(n=>groups.some(g=>g.id===n.groupId)));},[groups]);
 notificationContext.current={groups,profiles,selected,view};
 useEffect(()=>{if(view==='chat')setMessageNotices(old=>old.filter(n=>n.groupId!==selected));},[selected,view]);
 useEffect(()=>{const since=Date.now(),notified=new Set<string>();const channel=client.channel('group-sounds:'+user.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'group_messages'},payload=>{const message=payload.new as Message&{group_id:string};if(notificationGroups.current.has(message.group_id)&&shouldNotify(message,user.id,since)&&!notified.has(message.id)){notified.add(message.id);if(notified.size>1000)notified.delete(notified.values().next().value!);void notifySender(user.id,message.group_id,message.author_id).catch(()=>{});const context=notificationContext.current;if(notificationEligible(message,user.id,since,context.selected,context.view,document.visibilityState==='visible'&&document.hasFocus())){const group=context.groups.find(g=>g.id===message.group_id);if(group)setMessageNotices(old=>[...old,{id:message.id,groupId:group.id,groupName:group.name,sender:context.profiles[message.author_id]?.display_name||'Group member',preview:message.body?.trim().slice(0,160)||(message.content_id?'Sent an attachment':'New message')}].slice(-3));}}}).subscribe();return()=>{void client.removeChannel(channel);};},[user.id]);
 const group=groups.find(g=>g.id===selected);
 const joining=location.pathname.startsWith('/join/')?location.pathname.slice(6):'';
 const [joinPending,setJoinPending]=useState(Boolean(joining));
 const errorText=(err:unknown)=>err instanceof Error?err.message:typeof err==='object'&&err&&'message'in err?String(err.message):'Unable to complete this action. Please try again.';
 async function refreshUpdates(g:string){const r=await client.rpc('group_update_authors',{p_group_id:g});if(!r.error&&active.current===g)setUpdateAuthors(Object.fromEntries((r.data||[]).map((a:{author_id:string;unread:boolean})=>[a.author_id,a.unread])));}
 async function refreshGroups(){const {data,error}=await client.from('groups').select('id,name,description,timezone').order('created_at');if(error)throw error;setGroups(data||[]);return data||[];}
 useEffect(()=>{let live=true;(async()=>{try{const [groupResult,profileResult]=await Promise.all([client.from('groups').select('id,name,description,timezone').order('created_at'),client.from('profiles').select('*').eq('id',user.id).single()]);if(!live)return;if(groupResult.error)throw groupResult.error;if(profileResult.error)throw profileResult.error;setGroups(groupResult.data||[]);setMe(profileResult.data);const remembered=readNavigation(user.id);const restored=groupResult.data?.find(g=>g.id===remembered.groupId);setSelected(restored?.id||groupResult.data?.[0]?.id||'');if(!restored)setView('chat');}catch(err){if(live)setError(errorText(err));}finally{if(live)setLoading(false);}})();return()=>{live=false;};},[user.id]);
 function load(g:string,append=false){
  const queue=messageLoads.current;
  const next=queue.tail.then(()=>{
   if(queue!==messageLoads.current||active.current!==g)return;
   return loadMessages(g,append);
  });
  queue.tail=next.catch(()=>{});
  return next;
 }
 async function loadMessages(g:string,append=false){
  if(!g)return;const version=++request.current;
  const membership=await client.from('memberships').select('user_id,role').eq('group_id',g);
  if(active.current!==g||version!==request.current)return;
  if(membership.error)throw membership.error;
  const mine=membership.data?.find(m=>m.user_id===user.id);
  if(!mine){setMessages([]);setProfiles({});setSelected('');setInvite(null);setError('This group is no longer available to your account.');await refreshGroups();return;}
  setMemberIds((membership.data||[]).map(m=>m.user_id));void refreshUpdates(g);setRole(mine.role);setMembers(membership.data?.length||0);
  let q=client.from('group_messages').select('id,author_id,body,created_at,client_id,deleted_at,content_id').eq('group_id',g).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
  if(append&&loadedMessages.current.length){const first=loadedMessages.current[0];q=q.or(`created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`);}
  const result=await q;if(result.error)throw result.error;
  const deleted:Message[]=[];
  const ids=loadedMessages.current.map(m=>m.id);
  for(let i=0;i<ids.length;i+=100){
   const check=await client.from('group_messages').select('id,author_id,body,created_at,client_id,deleted_at,content_id').eq('group_id',g).in('id',ids.slice(i,i+100)).not('deleted_at','is',null);
   if(check.error)throw check.error;deleted.push(...(check.data||[]));
  }
  const profileResult=await client.from('profiles').select('*');if(profileResult.error)throw profileResult.error;
  if(active.current!==g||version!==request.current)return;
  setProfiles(Object.fromEntries((profileResult.data||[]).map(p=>[p.id,p])));
  const rows=(result.data||[]).reverse();
  const previous=loadedMessages.current,gap=!append&&refreshHasGap(previous,rows,50);
  const combined=new Map((gap?[]:previous).map(m=>[m.id,m]));
  (gap?rows:[...rows,...deleted]).forEach(m=>combined.set(m.id,m));
  const next=[...combined.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  loadedMessages.current=next;setMessages(next);
  if(append||!historyStarted.current||gap)setMore(rows.length===50);
  historyStarted.current=true;
 }
 useEffect(()=>{
  messageLoads.current={tail:Promise.resolve()};
  active.current=selected;loadedMessages.current=[];setUpdateAuthors({});setUpdateAuthor(undefined);setProfileView(null);setDeleting(null);historyStarted.current=false;setMessages([]);setProfiles({});setInvite(null);pending.current=null;setDraft('');setMore(false);if(!selected)return;
  let live=true;
  const refresh=()=>{if(document.visibilityState==='hidden')return;void load(selected).catch(err=>{if(live)setError(errorText(err));});};
  refresh();const channel=client.channel(`messages:${selected}`).on('postgres_changes',{event:'*',schema:'public',table:'group_messages',filter:`group_id=eq.${selected}`},refresh).subscribe();
  const interval=setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
  return()=>{live=false;active.current='';request.current++;clearInterval(interval);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);void client.removeChannel(channel);};
 },[selected,user.id]);
 async function action(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(err){setError(errorText(err));}finally{setBusy(false);}}
 async function send(e:React.FormEvent){e.preventDefault();if(attachmentSender.current){await attachmentSender.current();return;}if(!draft.trim()||!selected||busy)return;const g=selected,body=draft.trim();if(!pending.current||pending.current.group!==g||pending.current.body!==body)pending.current={group:g,body,id:crypto.randomUUID()};const id=pending.current.id;await action(async()=>{const {error}=await client.rpc('send_group_message',{p_group_id:g,p_client_id:id,p_body:body});if(error)throw error;if(active.current!==g)return;setDraft('');pending.current=null;await load(g);setTimeout(()=>end.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'end'}),0);});}
 async function signOut(){await action(async()=>{await client.removeAllChannels();const {error}=await client.auth.signOut();if(error)throw error;setMessages([]);setProfiles({});setGroups([]);location.replace('/login');});}
 return <div className="app-frame connected-app"><MessageNotifications items={messageNotices} onDismiss={id=>setMessageNotices(old=>old.filter(n=>n.id!==id))} onOpen={groupId=>{if(!notificationGroups.current.has(groupId))return;setSelected(groupId);setView('chat');setMobileMenu(false);setError('');setMessageNotices(old=>old.filter(n=>n.groupId!==groupId));}}/><aside className={`sidebar ${mobileMenu?'mobile-open':''}`}><div className="sidebar-brand"><a href="/groups" className="auth-brand"><img src="/logo.svg" alt=""/>apu chatter.</a><button className="mobile-only icon-btn" aria-label="Close groups" onClick={()=>setMobileMenu(false)}><X/></button></div><div className="section-label">YOUR GROUPS<button className="icon-btn" aria-label="Create a group" onClick={()=>setCreate(true)}><Plus/></button></div><nav aria-label="Your groups">{groups.map(g=><button key={g.id} className={`group-item ${selected===g.id?'selected':''}`} onClick={()=>{setSelected(g.id);setMobileMenu(false);setError('');}}><span className="group-icon"><UsersThree size={23}/></span><span><strong>{g.name}</strong><small>{g.description||'Your private corner'}</small></span></button>)}</nav>{!groups.length&&!loading&&<p className="empty-search">Your groups will appear here.</p>}<button className="new-group" onClick={()=>{setCreate(true);setMobileMenu(false);}}><Plus/> Create a group</button><div className="sidebar-bottom"><ThemeSettings userId={user.id}/>{group&&<SoundSettings key={selected} userId={user.id} groupId={selected} members={memberIds.map(id=>({id,display_name:profiles[id]?.display_name||'Member'}))}/>}<button className="profile-control" onClick={()=>setSettings(true)}><span className="avatar person-3"><Avatar path={me?.avatar_path} name={me?.display_name||'You'}/></span><span><strong>{me?.display_name||'Your profile'}</strong><small>{me?.status||'Make yourself at home'}</small></span><GearSix/></button><button className="text-button signout" disabled={busy} onClick={signOut}><SignOut/> Sign out</button></div></aside>
 <main className="main-area" data-wallpaper={roomStyle.look.wallpaper} data-room-motion={roomStyle.look.motion?'on':'off'}><header className="group-header"><button className="icon-btn mobile-only" aria-label="Show groups" onClick={()=>setMobileMenu(true)}><ArrowLeft/></button><div className="header-group-icon"><UsersThree size={26}/></div><div className="group-title"><h1>{group?.name||'Your corner of the world'}</h1><p>{group?`${members} ${members===1?'member':'members'} · Private group`:'A place for your people.'}</p></div>{group&&<button className="manage-group" onClick={()=>setControls(true)}><UsersThree size={17}/> Members</button>}{group&&role!=='member'&&<button className="invite-btn" disabled={busy} onClick={()=>action(async()=>{const {data,error}=await client.rpc('create_invite',{p_group_id:selected});if(error)throw error;setInvite(data);})}><Plus/> New invite link</button>}</header>
 <div className="tabs-row"><nav>{(['chat','updates','albums','board','ai'] as const).map(v=><button key={v} className={view===v?'active':''} onClick={()=>{setUpdateAuthor(undefined);setView(v);}}>{v==='ai'?'AI':v==='updates'?'Stories':v[0].toUpperCase()+v.slice(1)}</button>)}</nav><span className="prototype-label"><span/>Connected account</span></div>
 {group&&<div className="room-tools" role="group" aria-label="Group tools"> {group&&<Suspense fallback={null}><MusicRoom key={selected+user.id} groupId={selected} userId={user.id} dockTarget={musicDock} names={Object.fromEntries(Object.values(profiles).map(p=>[p.id,p.display_name]))}/></Suspense>}
 {group&&<Suspense fallback={null}><VoiceRoom key={selected+user.id} groupId={selected} userId={user.id} names={Object.fromEntries(Object.values(profiles).map(p=>[p.id,p.display_name]))}/></Suspense>}
 {group&&<ActivityPanel key={'activity:'+selected} groupId={selected}/>}
 {group&&<PrivateChats key={selected+user.id} groupId={selected} userId={user.id}/>}<RoomStyle key={'style:'+selected} look={roomStyle.look} onChange={roomStyle.change}/></div>}
 {error&&<div className="connected-alert" role="alert">{error}<button className="icon-btn" aria-label="Dismiss error" onClick={()=>setError('')}><X/></button></div>}{notice&&<div className="connected-notice" role="status">{notice}<button className="icon-btn" aria-label="Dismiss notice" onClick={()=>setNotice('')}><X/></button></div>}
 {joinPending&&<section className="join-banner"><Link size={25}/><div><h2>You’ve been invited.</h2><p>Join immediately with this invitation. You’ll be able to see the group’s history.</p></div><button className="primary-button" disabled={busy} onClick={()=>action(async()=>{if(!/^[a-f0-9]{64}$/.test(joining))throw new Error('This invitation is invalid.');const {data,error}=await client.rpc('join_group',{p_token:joining});if(error)throw error;await refreshGroups();setSelected(data);setJoinPending(false);history.replaceState({},'','/groups');setNotice('Welcome to your new group.');})}>Join group <ArrowRight/></button></section>}
 {invite&&<section className="invite-strip"><strong>Your invitation link</strong><p>Creating this link replaced the previous invite. Anyone with it can join unless banned.</p><div><input aria-label="Invitation link" readOnly value={`${location.origin}/join/${invite.token}`}/><button className="icon-btn" aria-label="Copy invitation" onClick={()=>action(async()=>{await navigator.clipboard.writeText(`${location.origin}/join/${invite.token}`);setNotice('Invitation copied.');})}><Copy/></button><button className="text-button" disabled={busy} onClick={()=>action(async()=>{const {error}=await client.rpc('revoke_invite',{p_invite_id:invite.invite_id});if(error)throw error;setInvite(null);setNotice('Invitation revoked.');})}>Revoke</button></div><div className="invite-qr"><QRCodeSVG value={location.origin + '/join/' + invite.token} size={130} level="M" marginSize={2} title="Group invitation QR code"/><p>Scan to join {group?.name}. This QR code uses the same invitation link above.</p></div></section>}
 {group&&view==='ai'?<AIPanel key={selected} groupId={selected} owner={role==='owner'}/>:group&&view==='board'?<BoardPanel key={selected} groupId={selected} userId={user.id} name={me?.display_name||'Member'}/>:group&&(view==='updates'||view==='albums')?<SharingPanel key={selected+view+(updateAuthor||'')} groupId={selected} userId={user.id} role={role} mode={view} names={Object.fromEntries(Object.values(profiles).map(p=>[p.id,p.display_name]))} authorId={updateAuthor} onSeen={()=>void refreshUpdates(selected)} onClearAuthor={()=>setUpdateAuthor(undefined)}/>:loading?<div className="connected-empty"><p>Finding your conversations…</p></div>:!group?<div className="connected-empty"><span className="welcome-symbol"><ChatCircle size={30}/></span><h2>Good conversations start here.</h2><p>Create your first group, or open an invitation from someone you know.</p><button className="primary-button" onClick={()=>setCreate(true)}>Create a group <Plus/></button></div>:<><div className="chat-scroll live-messages" onPointerMove={e=>{if(e.pointerType!=='mouse'||!roomStyle.look.motion||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const r=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--pointer-x',`${e.clientX-r.left}px`);e.currentTarget.style.setProperty('--pointer-y',`${e.clientY-r.top+e.currentTarget.scrollTop}px`);}} onPointerLeave={e=>{e.currentTarget.style.removeProperty('--pointer-x');e.currentTarget.style.removeProperty('--pointer-y');}}>{more&&<button className="load-older" disabled={older} onClick={async()=>{setOlder(true);try{await load(selected,true);}catch(e){setError(errorText(e));}finally{setOlder(false);}}}>{older?'Loading…':'Load earlier messages'}</button>}{!messages.length&&<div className="empty-chat"><ChatCircle size={36}/><h2>A fresh conversation.</h2><p>Be the first to say hello.</p></div>}{messages.map(m=><div className={`message ${m.author_id===user.id?'own':''}`} key={m.id}><button className={`avatar update-avatar ${updateAuthors[m.author_id]?'has-unread':''}`} aria-label={`View ${profiles[m.author_id]?.display_name||'member'} updates${updateAuthors[m.author_id]?', unread updates':''}`} onClick={()=>{setUpdateAuthor(m.author_id);setView('updates');}}><Avatar path={profiles[m.author_id]?.avatar_path} name={profiles[m.author_id]?.display_name||'Member'}/>{updateAuthors[m.author_id]&&<span className="update-dot"/>}</button><div className="message-content"><div className="message-meta"><button className="message-profile" onClick={()=>setProfileView(profiles[m.author_id]||null)}>{m.author_id===user.id?'You':profiles[m.author_id]?.display_name||'Member'}</button><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div><div className={`bubble ${m.deleted_at?'deleted-message':''}`}>{m.deleted_at?'Message deleted':m.body}</div>{!m.deleted_at&&m.content_id&&<ChatMedia contentId={m.content_id}/>}{!m.deleted_at&&(m.author_id===user.id||role!=='member')&&<button className="text-button delete-message" onClick={()=>setDeleting(m)}>Delete message</button>}{m.author_id===user.id&&<span className="sent-state"><Check/> Sent</span>}</div></div>)}<div ref={end}/></div><div className="composer-wrap"><Suspense fallback={<p role="status" className="composer-progress">Loading message tools…</p>}><ComposerTools key={selected+user.id} groupId={selected} userId={user.id} draft={draft} onDraft={setDraft} onSendReady={(handler,pending)=>{attachmentSender.current=handler;setHasAttachment(!!handler);setAttachmentBusy(pending);}} onSent={()=>{void load(selected).catch(e=>setError(errorText(e)));}}/></Suspense><form className="composer" onSubmit={send}><input aria-label="Message your group" placeholder={`Message ${group.name}…`} maxLength={4000} value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy}/><button className="send-btn" aria-label="Send message" disabled={busy||attachmentBusy||(!draft.trim()&&!hasAttachment)}><PaperPlaneTilt/></button></form><div className="composer-caption"><span>Only this group can read your messages.</span><span>{busy?'Sending…':'Enter to send'}</span></div></div></>}
 <div ref={setMusicDock} className="music-dock-slot"/>
 </main>
 {profileView&&<Sheet label="Member profile" onClose={()=>setProfileView(null)}><span className="avatar"><Avatar path={profileView.avatar_path} name={profileView.display_name}/></span><h2>{profileView.display_name}</h2><p>{profileView.status||'No status set.'}</p><p>{profileView.bio||'No bio yet.'}</p><button className="text-button" onClick={()=>setProfileView(null)}>Close profile</button></Sheet>}
 {deleting&&<Sheet label="Delete message" onClose={()=>setDeleting(null)}><h2>Delete this message?</h2><p>The text will be removed for everyone. A “Message deleted” marker will remain. This cannot be undone.</p>{error&&<p className="auth-error" role="alert">{error}</p>}<div className="delete-message-actions"><button className="danger-button" disabled={busy} onClick={()=>action(async()=>{const g=selected;const r=await client.rpc('delete_group_message',{p_message_id:deleting.id});if(r.error)throw r.error;if(active.current!==g)return;setDeleting(null);await load(g);})}>Delete for everyone</button><button className="text-button" disabled={busy} onClick={()=>setDeleting(null)}>Keep message</button></div></Sheet>}
 {controls&&group&&<GroupControls groupId={selected} groupName={group.name} userId={user.id} onClose={()=>setControls(false)} onChange={async()=>{await refreshGroups();await load(selected);}}/>}
 {create&&<Sheet label="Create group" onClose={()=>setCreate(false)}><button className="modal-close icon-btn" aria-label="Close create group" onClick={()=>setCreate(false)}><X/></button><h2>Make room for your people.</h2><p>A name, a few words, and a place to come together.</p><form onSubmit={e=>{e.preventDefault();void action(async()=>{const {data,error}=await client.rpc('create_group',{p_name:name.trim(),p_description:description,p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});if(error)throw error;await refreshGroups();setSelected(data);setName('');setDescription('');setCreate(false);});}}><label>Group name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><label>Description<input maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label>{error&&<p role="alert" className="auth-error">{error}</p>}<button className="primary-button" disabled={busy||!name.trim()}>{busy?'Creating…':'Create group'}<ArrowRight/></button></form></Sheet>}
 {settings&&me&&<Sheet label="Your profile" onClose={()=>setSettings(false)}><button className="modal-close icon-btn" aria-label="Close profile" onClick={()=>setSettings(false)}><X/></button><h2>A little about you.</h2><p>Your email stays private. Group members see these details.</p><div className="avatar-settings"><span className="avatar"><Avatar path={me.avatar_path} name={me.display_name}/></span><label>Profile photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void action(async()=>{const blob=await prepareAvatar(file),body=new FormData();body.set('file',blob,'avatar.jpg');const r=await client.functions.invoke('upload-avatar',{body});if(r.error)throw Error('Could not upload your photo. Please try again later.');setMe({...me,avatar_path:r.data.path});setProfiles(old=>({...old,[user.id]:{...me,avatar_path:r.data.path}}));setNotice('Profile photo updated.');});}}/></label>{me.avatar_path&&<button className="text-button" disabled={busy} onClick={()=>action(async()=>{const r=await client.rpc('remove_avatar');if(r.error)throw r.error;setMe({...me,avatar_path:null});setProfiles(old=>({...old,[user.id]:{...me,avatar_path:null}}));})}>Remove photo</button>}<small>Photos are cropped to a square and saved immediately.</small></div><form onSubmit={e=>{e.preventDefault();void action(async()=>{const {error}=await client.from('profiles').update({display_name:me.display_name.trim(),bio:me.bio,status:me.status}).eq('id',user.id);if(error)throw error;setSettings(false);setNotice('Profile updated.');});}}><label>Display name<input required maxLength={40} value={me.display_name} onChange={e=>setMe({...me,display_name:e.target.value})}/></label><label>Bio<input maxLength={160} value={me.bio} onChange={e=>setMe({...me,bio:e.target.value})}/></label><label>Status<input maxLength={80} value={me.status} onChange={e=>setMe({...me,status:e.target.value})}/></label>{error&&<p role="alert" className="auth-error">{error}</p>}<button className="primary-button" disabled={busy||!me.display_name.trim()}>Save profile <Check/></button></form><BlockedAccounts/></Sheet>}
 </div>;
}
