import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';

const uri=process.env.SPOTIFY_TEST_URI||'spotify:track:2Foc5Q5nqNiosCNqttzHof';
if(!/^spotify:(track|playlist):[a-zA-Z0-9]{22}$/.test(uri))throw Error('Use a Spotify track or playlist URI');
// Provider feasibility probe, not a substitute for testing MusicRoom.
const server=await createServer({server:{host:'127.0.0.1',port:5182,strictPort:true}});
await server.listen();
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 await page.route('**/spotify-probe',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><title>Spotify API feasibility</title><button id="play">Play</button><button id="pause">Pause</button><button id="seek">Seek</button><div id="player"></div><script>
 window.probe={ready:false,updates:[],started:[]};
 window.onSpotifyIframeApiReady=api=>api.createController(document.getElementById('player'),{uri:${JSON.stringify(uri)},width:600,height:352},controller=>{
 window.controller=controller;
 controller.addListener('ready',()=>window.probe.ready=true);
 controller.addListener('playback_update',e=>{window.probe.updates.push(e.data);window.probe.updates=window.probe.updates.slice(-12);});
 controller.addListener('playback_started',e=>window.probe.started.push(e.data));
 document.getElementById('play').onclick=()=>controller.play();
 document.getElementById('pause').onclick=()=>controller.pause();
 document.getElementById('seek').onclick=()=>controller.seek(10);
 });
 </script><script src="https://open.spotify.com/embed/iframe-api/v1" async></script>`}));
 await page.goto('http://127.0.0.1:5182/spotify-probe');
 await expect.poll(()=>page.evaluate(()=>window.probe.ready),{timeout:30000}).toBe(true);
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.probe.updates.some(e=>!e.isPaused&&e.position>1000)),{timeout:25000}).toBe(true);
 const duration=await page.evaluate(()=>window.probe.updates.at(-1).duration);
 await page.getByRole('button',{name:'Seek',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.probe.updates.at(-1)?.position),{timeout:5000}).toBeGreaterThanOrEqual(9500);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.probe.updates.at(-1)?.isPaused),{timeout:5000}).toBe(true);
 console.log(`PASS: actual signed-out Spotify ${uri.split(':')[1]} embed played, advanced, sought to 10 seconds and paused. Available duration: ${duration}ms. This is provider feasibility evidence, not MusicRoom integration or full-track verification.`);
 if(uri.startsWith('spotify:playlist:')){
  const frame=page.frameLocator('iframe'),firstURI=await page.evaluate(()=>window.probe.started.at(-1)?.playingURI);
  for(const close of await frame.getByRole('button',{name:'Close',exact:true}).all())if(await close.isVisible())await close.click();
  await frame.getByRole('button',{name:'Play track',exact:true}).nth(1).click();
  await expect.poll(()=>page.evaluate(first=>window.probe.started.some(e=>e.playingURI!==first&&/^spotify:track:/.test(e.playingURI)),firstURI),{timeout:15000}).toBe(true);
  await page.getByRole('button',{name:'Pause',exact:true}).click();console.log('PASS: native playlist track selection exposes a different track URI through the official API.');
 }
 console.log('Observed playback entities:',JSON.stringify(await page.evaluate(()=>window.probe.started)));
 await page.screenshot({path:'docs/design/spotify-provider-probe.png'});
}finally{await browser.close();await server.close();}
