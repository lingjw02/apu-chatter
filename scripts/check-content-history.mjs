import assert from 'node:assert/strict';
import { mergeContent, contentCursor } from '../src/features/sharing/history.ts';
const a={id:'a',created_at:'2026-01-01T00:00:00.000Z',state:'live'},b={...a,id:'b'},c={...a,id:'c',created_at:'2026-01-02T00:00:00.000Z'};
assert.deepEqual(mergeContent([a,b],[c,b]).map(x=>x.id),['c','b','a']);
assert.deepEqual(mergeContent([a,b],[{...a,state:'deleted'}]).map(x=>x.id),['b']);
assert.match(contentCursor(a),/created_at.eq.2026-01-01T00:00:00.000Z,id.lt.a/);
assert.equal(mergeContent([a],[{...a,caption:'changed'}])[0].caption,'changed');
console.log('PASS: stable history ordering, tied timestamps, deduplication and deleted-record reconciliation.');
