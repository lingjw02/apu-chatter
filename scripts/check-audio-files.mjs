import {Input,BlobSource,MP4,WEBM} from 'mediabunny';
import {spawnSync} from 'node:child_process';import {readFile,mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';
import {validateAudioDuration} from '../supabase/functions/_shared/audio-validation.mjs';
await mkdir('test-results/media',{recursive:true});
for(const extension of ['webm','mp4'])for(const seconds of [1,121]){
 const path=`test-results/media/audio-${seconds}.${extension}`;const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t',String(seconds),'-c:a',extension==='webm'?'libopus':'aac','-b:a','32k',path],{encoding:'utf8'});if(r.status!==0)throw Error('Audio fixture generation failed');
 const input=new Input({source:new BlobSource(new Blob([await readFile(path)])),formats:[MP4,WEBM]});if(seconds===1)await validateAudioDuration(input);else await assert.rejects(validateAudioDuration(input));
}
console.log('PASS: real MP4/WebM audio accepted; 121-second audio rejected.');
