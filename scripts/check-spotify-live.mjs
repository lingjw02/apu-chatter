import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
const server=await createServer({server:{host:'127.0.0.1',port:5182,strictPort:true}});await server.listen();const browser=await chromium.launch();let page;
try{
 page=await browser.newPage({viewport:{width:1200,height:900}});
 await page.addInitScript(()=>{
  window.__spotifyChecks=[];
  let callback;
  Object.defineProperty(window,'onSpotifyIframeApiReady',{configurable:true,get(){return callback;},set(value){callback=api=>{
   const create=api.createController.bind(api);
   api.createController=(node,options,onCreate)=>create(node,options,p=>{
    const check={ready:false,state:null};window.__spotifyChecks.push(check);
    p.addListener('ready',()=>check.ready=true);p.addListener('playback_update',e=>check.state=e.data);
    onCreate(p);
   });value(api);
  };}});
 });
 await page.goto('http://127.0.0.1:5182/scripts/fixtures/spotify-player.html');
 await expect.poll(()=>page.evaluate(()=>window.__spotifyChecks.filter(p=>p.ready).length),{timeout:30000}).toBe(2);
 await page.getByRole('button',{name:'Play together',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__spotifyChecks.filter(p=>p.state&&!p.state.isPaused&&p.state.position>1000).length),{timeout:25000}).toBe(2);
 await expect.poll(()=>page.evaluate(()=>Math.abs(window.__spotifyChecks[0].state.position-window.__spotifyChecks[1].state.position)),{timeout:10000}).toBeLessThan(3000);
 await page.getByRole('button',{name:'Seek together',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__spotifyChecks.filter(p=>p.state.position>=9500).length),{timeout:5000}).toBe(2);
 await page.getByRole('button',{name:'Pause together',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__spotifyChecks.filter(p=>p.state.isPaused).length),{timeout:5000}).toBe(2);
 await page.screenshot({path:'docs/design/spotify-components-live.png'});
 console.log('PASS: two real SpotifyPlayer components played a preview, advanced within 3 seconds, followed seek and paused. Local shared-state fixture; hosted session transport and full tracks are not covered.');
}catch(error){if(page)await page.screenshot({path:'docs/design/spotify-components-failure.png'}).catch(()=>{});console.error(error.message);process.exitCode=1;}finally{await browser.close();await server.close();}
