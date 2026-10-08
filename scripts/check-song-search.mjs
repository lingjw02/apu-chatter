import assert from 'node:assert/strict';
import {catalogMatches,searchSong} from '../supabase/functions/_shared/song-search.mjs';
const rows={results:[{kind:'song',trackId:123,collectionId:456,trackName:'Song',artistName:'Artist',collectionName:'Album'},{kind:'song',trackId:123,collectionId:456,trackName:'Duplicate',artistName:'Artist'},{kind:'song',trackId:'javascript:bad',collectionId:456,trackName:'Bad',artistName:'Bad'}]};
assert.deepEqual(catalogMatches(rows,'MY'),[{provider:'apple',kind:'track',external_id:'my:456:123',title:'Song',artist:'Artist',album:'Album'}]);
let calls=0;const fetcher=async(url,options)=>{calls++;if(String(url).startsWith('https://openrouter.ai/')){const body=JSON.parse(options.body);assert.equal(body.model,'qwen/qwen3.8-27b:free');assert.ok(!body.messages[1].content.includes('sk-secretvalue'));return Response.json({choices:[{message:{content:'{"terms":"Song Artist"}'}}]});}assert.equal(new URL(url).hostname,'itunes.apple.com');assert.equal(new URL(url).searchParams.get('term'),'Song Artist');return Response.json(rows);};
assert.equal((await searchSong('Song Artist sk-secretvalue','MY','test-key',fetcher,'qwen/qwen3.8-27b:free')).matches.length,1);assert.equal(calls,2);
await assert.rejects(searchSong('','MY','test-key',fetcher));await assert.rejects(searchSong('x','ZZ','test-key',fetcher));
await assert.rejects(searchSong('x','MY','test-key',async()=>Response.json({choices:[{message:{content:'{"terms":"https://evil.example"}'}}]})));
console.log('PASS: real-catalog-only IDs, deduplicated matches, bounded input, supported storefronts, fixed provider endpoints and redacted AI input.');

await assert.rejects(searchSong('x','MY','test-key',async()=>new Response('',{status:429}),'qwen/qwen3.8-27b:free'),/Song search rate limited/);
await assert.rejects(searchSong('x','MY','test-key',fetcher,'qwen/qwen3.8-27b'),/Unsupported free model/);
