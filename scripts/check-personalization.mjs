import assert from 'node:assert/strict';
import { validateTheme, compileThemeCSS, defaultTheme, soundFor, shouldNotify } from '../src/features/personalization/preferences.ts';
assert.deepEqual(validateTheme(JSON.parse(JSON.stringify(defaultTheme))), defaultTheme);
assert.throws(()=>validateTheme({...defaultTheme,accent:'url(https://example.com)'}));
assert.throws(()=>validateTheme({...defaultTheme,radius:200}));
assert.match(compileThemeCSS('.bubble { border-radius: 12px; background-color: #ffffff; }'),/\.connected-app > \.main-area \.bubble/);
assert.match(compileThemeCSS('.group-item:hover { background-color: #ddeeee; padding: 12px 16px; }'),/\.connected-app > \.sidebar \.group-item:hover/);
assert.match(compileThemeCSS('.tabs-row button { padding: 8px 12px; transition: color 150ms ease; }'),/prefers-reduced-motion/);
assert.throws(()=>compileThemeCSS('.profile-control { color: #ffffff; }'));
assert.throws(()=>compileThemeCSS('.bubble { padding: 500px; }'));
assert.throws(()=>compileThemeCSS('.group-item:hover { opacity: 0; }'));
for(const css of ['body { color: #fff; }','.bubble { background-image: url(https://example.com); }','.bubble { position: fixed; }','@import "x";','.bubble, dialog { color: #fff; }','.bubble { color: var(--secret); }','.bubble { color: #fff; } garbage'])assert.throws(()=>compileThemeCSS(css),css);
for(const selector of ['.sharing-open','.board-tabs button','.board-tools button','.music-session-controls button','.music-add input','.music-queue','.voice-actions button','.voice-toggle','.ai-actions button','.ai-result','.ai-sources button']){
 assert.ok(compileThemeCSS(selector+' { border-radius: 12px; }').includes('.connected-app > .main-area '+selector+'{border-radius:12px}'));
}
for(const selector of ['.ai-disclosure button','.confirmation-actions button','.safety-controls button','.preference-actions button','.auth-form input'])assert.throws(()=>compileThemeCSS(selector+' { color: #ffffff; }'));
const preferences={muted:false,senders:{alice:'pop',bob:'silent'}};
assert.equal(soundFor(preferences,'alice'),'pop');assert.equal(soundFor(preferences,'bob'),'silent');assert.equal(soundFor(preferences,'new'),'chime');assert.equal(soundFor({...preferences,muted:true},'alice'),'silent');
assert.equal(shouldNotify({author_id:'alice',created_at:new Date().toISOString(),deleted_at:null},'bob',Date.now()-1000),true);
assert.equal(shouldNotify({author_id:'bob',created_at:new Date().toISOString()},'bob',0),false);
assert.equal(shouldNotify({author_id:'alice',created_at:'2020-01-01'},'bob',Date.now()),false);
console.log('PASS: theme validation, CSS confinement, sender sounds, mute and historical/self-message suppression.');
