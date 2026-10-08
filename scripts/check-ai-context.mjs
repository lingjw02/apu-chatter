import assert from 'node:assert/strict';
import {buildContext} from '../supabase/functions/_shared/ai-context.mjs';
const sample=buildContext([{id:'m1',body:'Email me at example@example.com password=hunter22. Decision: meet Friday.'}]);assert.ok(!sample.text.includes('example@example.com'));assert.ok(!sample.text.includes('hunter22'));assert.ok(sample.text.includes('Friday'));assert.deepEqual(sample.sources,['m1']);
const limited=buildContext(Array.from({length:201},(_,i)=>({id:'m'+i,body:'x'.repeat(1000)})));assert.equal(limited.partial,true);assert.ok(new TextEncoder().encode(limited.text).length<6100);assert.ok(limited.sources.length<201);
console.log('PASS: AI context bounds, source IDs and credential/email pattern redaction.');
