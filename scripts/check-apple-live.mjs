import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
const server=await createServer({server:{host:'127.0.0.1',port:5182,strictPort:true}});
await server.listen();const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{window.__playedMedia=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(!window.__playedMedia.includes(this))window.__playedMedia.push(this);return play.apply(this,args);};});
 await page.route('**/apple-probe',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Apple Music embed check</title><iframe title="Apple Music" width="660" height="450" allow="autoplay; encrypted-media" src="https://embed.music.apple.com/my/album/617154241?i=617154366"></iframe>'}));
 await page.goto('http://127.0.0.1:5182/apple-probe');
 const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'Play',exact:true}).click({timeout:30000});
 const provider=page.frames().find(f=>f.url().startsWith('https://embed.music.apple.com/'));
 if(!provider)throw Error('Apple Music frame unavailable');
 await expect.poll(()=>provider.evaluate(()=>window.__playedMedia.some(m=>!m.paused&&m.currentTime>1)),{timeout:20000}).toBe(true);
 await page.screenshot({path:'docs/design/apple-provider-playing.png'});
 await frame.getByRole('button',{name:/^pause$/i}).first().click();
 await expect.poll(()=>provider.evaluate(()=>window.__playedMedia.every(m=>m.paused)),{timeout:5000}).toBe(true);
 console.log('PASS: signed-out Apple Music official embed preview advances and pauses after user gestures. Provider fixture only; no full-song or shared synchronization claim.');
 await page.screenshot({path:'docs/design/apple-provider-playback.png'});
}finally{await browser.close();await server.close();}
