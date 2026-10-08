import assert from 'node:assert/strict';
import {performJob,aiConfigured} from '../supabase/functions/_shared/ai.ts';
globalThis.Deno={env:{get:name=>name==='OPENROUTER_MODEL'?'qwen/qwen3.8-27b:free':name==='OPENROUTER_API_KEY'?'test-only':undefined}};
const id=crypto.randomUUID(),calls=[];let output=JSON.stringify({summary:'A study plan.',topics:[{label:'Study',sources:[id]}]});
globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);assert.equal(body.model,'qwen/qwen3.8-27b:free');assert.equal(body.provider.data_collection,'deny');return Response.json({choices:[{message:{content:output}}]});};
const service={rpc:async(name,args)=>{calls.push({name,args});return name==='ai_job_context'?{data:[{id,body:'Let us study tomorrow.'}]}:{data:null};}};
await performJob(service,{id:crypto.randomUUID(),kind:'weekly'});
assert.equal(calls.at(-1).name,'complete_weekly_ai');assert.equal(calls.at(-1).args.p_topics[0].label,'Study');assert.equal(calls.at(-1).args.p_result,'A study plan.');
output='malformed';await performJob(service,{id:crypto.randomUUID(),kind:'weekly'});assert.equal(calls.at(-1).args.p_state,'failed');
output='An ordinary requested summary.';await performJob(service,{id:crypto.randomUUID(),kind:'summary'});assert.equal(calls.at(-1).name,'complete_ai_job');assert.equal(calls.at(-1).args.p_state,'done');
console.log('PASS: weekly worker saves structured topics, fails closed on invalid output, and preserves requested summaries. Provider mocked.');

assert.equal(aiConfigured(),true);globalThis.Deno.env.get=name=>name==='OPENROUTER_MODEL'?'qwen/qwen3.8-27b':'test-only';assert.equal(aiConfigured(),false);
