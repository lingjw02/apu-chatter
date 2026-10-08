import assert from 'node:assert/strict';
import {validateAudioDuration} from '../supabase/functions/_shared/audio-validation.mjs';
let disposed=0;const input=(duration,audio=true,video=false)=>({getPrimaryAudioTrack:async()=>audio?{}:null,getPrimaryVideoTrack:async()=>video?{}:null,computeDuration:async()=>duration,getFirstTimestamp:async()=>0,dispose:()=>disposed++});
await validateAudioDuration(input(5));
for(const source of [input(121),input(0),input(NaN),input(1,false),input(1,true,true)])await assert.rejects(validateAudioDuration(source));
assert.equal(disposed,6);console.log('PASS: audio duration/track validation and disposal.');
