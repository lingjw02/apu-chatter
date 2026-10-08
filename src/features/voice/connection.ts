import {supabase} from '../../lib/supabase';
export type VoiceMember={session_id:string;user_id:string;group_id:string;last_seen:string};
type Peer={pc:RTCPeerConnection;candidates:RTCIceCandidateInit[]};
type Events={members:(members:VoiceMember[])=>void;remote:(id:string,stream:MediaStream|null)=>void;status:(id:string,status:RTCPeerConnectionState)=>void;error:(message:string)=>void;muted:()=>void;ended:()=>void};
export class VoiceConnection{
 readonly id=crypto.randomUUID();private stream:MediaStream|null=null;private closed=false;private joined=false;private peers=new Map<string,Peer>();private timer:ReturnType<typeof setInterval>|undefined;private processing=false;private lastHeartbeat=0;private ice:RTCIceServer[]=[];private seen=new Set<string>();private expiry:ReturnType<typeof setTimeout>|undefined;
 constructor(private group:string,private user:string,private events:Events){}
 async start(){
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Voice needs a supported browser and a secure connection.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  if(this.closed){stream.getTracks().forEach(t=>t.stop());throw Error('Voice was cancelled.');}this.stream=stream;this.mute();
  try{const joined=await supabase!.rpc('join_voice',{p_group_id:this.group,p_session_id:this.id});if(joined.error)throw joined.error;this.joined=true;if(this.closed){await this.stop();throw Error('Voice was cancelled.');}
   const config=await supabase!.functions.invoke('voice-ice',{body:{sessionId:this.id}});if(config.error)throw Error('Could not configure voice. Please try again.');if(this.closed){await this.stop();throw Error('Voice was cancelled.');}
   this.ice=Array.isArray(config.data.iceServers)?config.data.iceServers:[config.data.iceServers];
   this.lastHeartbeat=Date.now();await this.poll();if(this.closed)throw Error('Voice ended before connecting.');this.timer=setInterval(()=>void this.poll(),1000);
   this.expiry=setTimeout(()=>{this.events.error('This voice session reached its one-hour limit. Rejoin to continue.');void this.stop();},55*60000);
   return !!config.data.relayAvailable;
  }catch(e){await this.stop();throw e;}
 }
 mute(){this.stream?.getAudioTracks().forEach(t=>t.enabled=false);this.events.muted();}
 talk(enabled:boolean){if(this.closed||!this.joined)return;this.stream?.getAudioTracks().forEach(t=>t.enabled=enabled);}
 private async send(recipient:string,payload:unknown){if(this.closed)return;const r=await supabase!.rpc('send_voice_signal',{p_sender:this.id,p_recipient:recipient,p_payload:payload});if(r.error&&!this.closed)throw Error('Voice signaling was interrupted. Leave and rejoin to retry.');}
 private createPeer(id:string){
  const existing=this.peers.get(id);if(existing)return existing;
  const pc=new RTCPeerConnection({iceServers:this.ice}),peer={pc,candidates:[] as RTCIceCandidateInit[]};this.peers.set(id,peer);
  for(const track of this.stream!.getTracks())pc.addTrack(track,this.stream!);
  pc.onicecandidate=e=>{if(e.candidate)void this.send(id,{type:'candidate',candidate:e.candidate.toJSON()}).catch(e=>this.events.error(e.message));};
  pc.ontrack=e=>{if(!this.closed)this.events.remote(id,e.streams[0]||new MediaStream([e.track]));};
  pc.onconnectionstatechange=()=>{if(this.closed)return;this.events.status(id,pc.connectionState);if(pc.connectionState==='failed'||pc.connectionState==='disconnected'){this.mute();this.events.error('A voice connection was interrupted. Your microphone is muted; leave and rejoin if it does not recover.');}};
  return peer;
 }
 private async poll(){if(this.closed||this.processing)return;this.processing=true;try{
  if(Date.now()-this.lastHeartbeat>=12000){const heartbeat=await supabase!.rpc('heartbeat_voice',{p_session_id:this.id});if(heartbeat.error)throw Error('Your voice session ended.');this.lastHeartbeat=Date.now();}
  const [members,signals]=await Promise.all([supabase!.from('voice_members').select('session_id,user_id,group_id,last_seen').eq('group_id',this.group).gt('last_seen',new Date(Date.now()-45000).toISOString()),supabase!.from('voice_signals').select('id,sender_session,payload').eq('recipient_session',this.id).order('created_at').limit(200)]);
  if(this.closed)return;if(members.error||signals.error)throw Error('Voice access could not be verified.');const rows=members.data||[];if(!rows.some(m=>m.session_id===this.id&&m.user_id===this.user))throw Error('You are no longer in this voice room.');this.events.members(rows);
  const active=new Set(rows.map(m=>m.session_id));for(const [id,peer] of this.peers)if(!active.has(id)){peer.pc.close();this.peers.delete(id);this.events.remote(id,null);}
  for(const member of rows){const id=member.session_id;if(id===this.id||this.peers.has(id))continue;const peer=this.createPeer(id);if(this.id<id){await peer.pc.setLocalDescription(await peer.pc.createOffer());if(this.closed)return;await this.send(id,{type:'offer',sdp:peer.pc.localDescription!.sdp});}}
  for(const signal of signals.data||[]){if(this.closed)return;if(this.seen.has(signal.id)||!active.has(signal.sender_session))continue;const peer=this.createPeer(signal.sender_session),payload=signal.payload;
   if(payload.type==='candidate'){if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(payload.candidate);else peer.candidates.push(payload.candidate);}
   else if(payload.type==='offer'||payload.type==='answer'){
    if(payload.type==='offer'&&this.id<signal.sender_session)continue;
    await peer.pc.setRemoteDescription({type:payload.type,sdp:payload.sdp});
    for(const candidate of peer.candidates)await peer.pc.addIceCandidate(candidate);peer.candidates=[];
    if(payload.type==='offer'){await peer.pc.setLocalDescription(await peer.pc.createAnswer());await this.send(signal.sender_session,{type:'answer',sdp:peer.pc.localDescription!.sdp});}
   }
   this.seen.add(signal.id);
  }
  if(signals.data?.length){const cleared=await supabase!.from('voice_signals').delete().in('id',signals.data.map(s=>s.id));if(!cleared.error)signals.data.forEach(s=>this.seen.delete(s.id));}
 }catch(e){if(!this.closed){this.events.error(e instanceof Error?e.message:'Could not maintain voice.');await this.stop();}}finally{this.processing=false;}}
 async stop(){this.closed=true;clearInterval(this.timer);clearTimeout(this.expiry);this.mute();this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;for(const [id,p] of this.peers){p.pc.close();this.events.remote(id,null);}this.peers.clear();this.events.ended();if(this.joined){this.joined=false;await supabase!.rpc('leave_voice',{p_session_id:this.id});}}
}
