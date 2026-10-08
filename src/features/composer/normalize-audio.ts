/** Re-mux recorder streams into a finalized, seekable file without re-encoding audio. */
export async function normalizeAudio(blob:Blob):Promise<Blob>{
 const {Input,BlobSource,MP4,WEBM,Output,BufferTarget,WebMOutputFormat,Mp4OutputFormat,Conversion}=await import('mediabunny');
 const input=new Input({source:new BlobSource(blob),formats:[MP4,WEBM]});
 try{
  const output=new Output({format:blob.type.includes('mp4')?new Mp4OutputFormat({fastStart:'in-memory'}):new WebMOutputFormat(),target:new BufferTarget()});
  const conversion=await Conversion.init({input,output,video:{discard:true}});
  if(!conversion.isValid)throw Error('This recording could not be prepared. Try recording again.');
  await conversion.execute();if(!output.target.buffer)throw Error('Recording is empty.');
  const result=new Blob([output.target.buffer],{type:blob.type.split(';')[0]});
  if(result.size>5242880)throw Error('Try a shorter voice message (maximum 5 MB).');
  return result;
 }finally{input.dispose();}
}
