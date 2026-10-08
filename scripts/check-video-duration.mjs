import { Input,BlobSource,MP4,WEBM } from 'mediabunny';
import { spawnSync } from 'node:child_process';
import { mkdir,readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { validateVideoDuration } from '../supabase/functions/_shared/video-validation.mjs';
await mkdir('test-results/media',{recursive:true});
for(const extension of ['mp4','webm'])for(const seconds of [1,31]){
 const path=`test-results/media/${seconds}.${extension}`;
 const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=64x64:r=1','-t',String(seconds),'-an','-c:v',extension==='mp4'?'libx264':'libvpx-vp9',path],{encoding:'utf8'});
 if(r.status!==0)throw Error('ffmpeg fixture generation failed');
 const input=new Input({source:new BlobSource(new Blob([await readFile(path)])),formats:[MP4,WEBM]});
 if(seconds===1)await validateVideoDuration(input);else await assert.rejects(validateVideoDuration(input),/30 seconds/);
}
await assert.rejects(validateVideoDuration(new Input({source:new BlobSource(new Blob(['not a video'])),formats:[MP4,WEBM]})));
console.log('PASS: actual MP4/WebM short clips accepted; 31-second and malformed files rejected.');
