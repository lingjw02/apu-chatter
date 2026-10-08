import assert from 'node:assert/strict';
import {requestFreeCompletion} from '../supabase/functions/_shared/ai-model.mjs';
const primary='qwen/qwen3.8-27b:free',seen=[];
let statuses=[429,200];const fetcher=async(_,options)=>{const body=JSON.parse(options.body);seen.push(body.model);assert.equal(body.provider.data_collection,'deny');return Response.json({},{status:statuses.shift()});};
const payload={provider:{data_collection:'deny'},messages:[],max_tokens:150};
assert.equal((await requestFreeCompletion('test',primary,payload,fetcher,'openrouter/free')).status,200);assert.deepEqual(seen,[primary,'openrouter/free']);
seen.length=0;statuses=[401];assert.equal((await requestFreeCompletion('test',primary,payload,fetcher,'openrouter/free')).status,401);assert.deepEqual(seen,[primary]);
seen.length=0;statuses=[429];assert.equal((await requestFreeCompletion('test',primary,payload,fetcher)).status,429);assert.deepEqual(seen,[primary]);
await assert.rejects(requestFreeCompletion('test',primary,payload,fetcher,'paid/model'),/Unsupported/);
console.log('PASS: opted-in free-only fallback on rate limit, privacy preserved, no auth-error fallback and no implicit fallback.');

seen.length=0;statuses=[402];assert.equal((await requestFreeCompletion('test',primary,payload,fetcher,'openrouter/free')).status,402);assert.deepEqual(seen,[primary]);
seen.length=0;statuses=[503,429];assert.equal((await requestFreeCompletion('test',primary,payload,fetcher,'openrouter/free')).status,429);assert.deepEqual(seen,[primary,'openrouter/free']);
let attempts=0;const network=async()=>{if(++attempts===1)throw Error('Synthetic network failure');return Response.json({});};assert.equal((await requestFreeCompletion('test',primary,payload,network,'openrouter/free')).status,200);assert.equal(attempts,2);
