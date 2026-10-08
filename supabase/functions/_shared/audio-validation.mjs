export async function validateAudioDuration(input){
 let timer;
 try{await Promise.race([(async()=>{
  const audio=await input.getPrimaryAudioTrack(),video=await input.getPrimaryVideoTrack();
  const duration=await input.computeDuration(),first=await input.getFirstTimestamp();
  if(!audio||video||!Number.isFinite(duration)||!Number.isFinite(first)||duration<=0||duration>120||duration-first>120)throw Error('Voice messages must be audio-only and at most 120 seconds.');
 })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Audio validation timed out.')),8000);})]);}
 finally{clearTimeout(timer);input.dispose();}
}
