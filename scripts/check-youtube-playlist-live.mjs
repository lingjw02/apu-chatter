import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
const server=await createServer({server:{host:'127.0.0.1',port:5182,strictPort:true}});await server.listen();const browser=await chromium.launch();let page;
try{
 page=await browser.newPage({viewport:{width:1300,height:900}});page.on('pageerror',e=>console.error('Browser error: '+e.message));await page.addInitScript(()=>{window.__playlistPlayers=[];window.onYouTubeIframeAPIReady=()=>{window.YT.Player=new Proxy(window.YT.Player,{construct(Target,args){const p=Reflect.construct(Target,args);window.__playlistPlayers.push(p);return p;}});};});
 await page.route('**/playlist-component-check',async r=>r.fulfill({contentType:'text/html',body:await server.transformIndexHtml('/playlist-component-check','<!doctype html><div id="root"></div><script type="module" src="/scripts/fixtures/youtube-playlist.tsx"></script>')}));
 await page.goto('http://127.0.0.1:5182/playlist-component-check');await expect(page.getByRole('heading',{name:'Real YouTube playlist components',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__playlistPlayers.filter(p=>p.getPlaylist?.()?.length>1).length),{timeout:30000}).toBe(2);
 await page.getByRole('button',{name:'Play together',exact:true}).click();for(const section of ['Host','Listener'])await page.getByRole('region',{name:section,exact:true}).getByRole('button',{name:'Enable playlist audio',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__playlistPlayers.filter(p=>p.getPlayerState()===1).length),{timeout:25000}).toBe(2);
 await page.getByRole('button',{name:'Next playlist track',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__playlistPlayers.filter(p=>p.getPlaylistIndex()===1&&p.getPlayerState()===1).length),{timeout:20000}).toBe(2);
 await expect.poll(()=>page.evaluate(()=>new Set(window.__playlistPlayers.map(p=>p.getVideoData().video_id)).size)).toBe(1);
 await page.getByRole('button',{name:'Pause together',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__playlistPlayers.filter(p=>p.getPlayerState()===2).length),{timeout:10000}).toBe(2);
 // Simulate the same native player event produced by automatic playlist advancement.
 await page.evaluate(()=>window.__playlistPlayers[0].playVideoAt(2));await expect.poll(()=>page.evaluate(()=>window.__playlistPlayers.filter(p=>p.getPlaylistIndex()===2).length),{timeout:20000}).toBe(2);
 await expect.poll(()=>page.evaluate(()=>window.__playlistPlayers[0].getDuration()),{timeout:10000}).toBeGreaterThan(1);await page.getByRole('button',{name:'Finish current track',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__playlistPlayers.filter(p=>p.getPlaylistIndex()===3).length),{timeout:25000}).toBe(2);
 await expect.poll(()=>page.evaluate(()=>window.__playlistPlayers.filter(p=>p.getPlayerState()===1&&p.getCurrentTime()>0.5).length),{timeout:20000}).toBe(2);
 await page.screenshot({path:'docs/design/youtube-playlist-components.png'});console.log('PASS: real host/follower playlist components play, align selected video IDs, switch via app and native player, and pause. Hosted transport not covered.');
}catch(e){if(page){console.log('Player state:',await page.evaluate(()=>window.__playlistPlayers?.map(p=>({index:p.getPlaylistIndex?.(),state:p.getPlayerState?.(),video:p.getVideoData?.()?.video_id}))).catch(()=>null));await page.screenshot({path:'docs/design/youtube-playlist-components-failure.png'}).catch(()=>{});}console.error(e.message);process.exitCode=1;}finally{await browser.close();await server.close();}
