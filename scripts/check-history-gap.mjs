import assert from 'node:assert/strict';
import {refreshHasGap} from '../src/lib/history-gap.ts';
const row=id=>({id});
assert.equal(refreshHasGap([row('old')],[row('new3'),row('new2')],2),true,'Disconnected full page requires a new paging boundary');
assert.equal(refreshHasGap([row('old')],[row('new'),row('old')],2),false,'Overlapping pages retain already loaded history');
assert.equal(refreshHasGap([row('old')],[row('new')],2),false,'A short latest page contains all available results');
assert.equal(refreshHasGap([],[row('new2'),row('new1')],2),false,'Initial load has no previous boundary');
assert.equal(refreshHasGap([row('old'),row('overlap')],[row('new'),row('overlap')],2),false,'Overlap detection is independent of ordering');
console.log('PASS: reconnect gap detection, overlap retention, complete short pages and initial load.');
