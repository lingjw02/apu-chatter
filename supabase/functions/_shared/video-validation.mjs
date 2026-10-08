// Input is constructed from a bounded uploaded Blob, never a remote URL.
export async function validateVideoDuration(input){
 let timer;
 try{
  await Promise.race([(async()=>{
   const video=await input.getPrimaryVideoTrack();if(!video)throw Error('A video track is required.');
   const duration=await input.computeDuration();const first=await input.getFirstTimestamp();
   if(!Number.isFinite(duration)||!Number.isFinite(first)||duration<=0||duration>30||duration-first>30)throw Error('Videos must be at most 30 seconds.');
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Video validation timed out.')),8000);})]);
 }finally{clearTimeout(timer);input.dispose();}
}
