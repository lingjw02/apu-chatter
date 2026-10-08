import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
const playlist=process.env.YOUTUBE_TEST_PLAYLIST||'PLUl4u3cNGP63EdVPNLG3ToM6LaEUuStEY';
if(!/^[A-Za-z0-9_-]{10,100}$/.test(playlist))throw Error('Invalid test playlist ID');
const server=await createServer({server:{host:'127.0.0.1',port:5182,strictPort:true}});await server.listen();
const browser=await chromium.launch();let page;
try{
 page=await browser.newPage();
 await page.route('**/youtube-playlist-probe',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><title>YouTube playlist feasibility</title><button id="play">Play</button><button id="second">Second video</button><button id="pause">Pause</button><div id="player"></div><script>
 window.probe={ready:false,events:[],errors:[]};window.onYouTubeIframeAPIReady=()=>{
 window.player=new YT.Player('player',{width:640,height:360,playerVars:{origin:location.origin,listType:'playlist',list:'${playlist}',playsinline:1},events:{onReady(){window.probe.ready=true;},onStateChange(e){window.probe.events.push({state:e.data,index:player.getPlaylistIndex()});},onError(e){window.probe.errors.push(e.data);}}});
 document.getElementById('play').onclick=()=>player.playVideo();document.getElementById('second').onclick=()=>player.playVideoAt(1);document.getElementById('pause').onclick=()=>player.pauseVideo();
 };</script><script src="https://www.youtube.com/iframe_api"></script>`}));
 await page.goto('http://127.0.0.1:5182/youtube-playlist-probe');
 await expect.poll(()=>page.evaluate(()=>window.probe.ready),{timeout:30000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.player.getPlaylist()?.length||0),{timeout:15000}).toBeGreaterThan(1);
 console.log('Provider playlist:',await page.evaluate(()=>({length:player.getPlaylist().length,index:player.getPlaylistIndex(),errors:probe.errors})));
 await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(()=>page.evaluate(()=>player.getPlayerState()),{timeout:25000}).toBe(1);
 await page.getByRole('button',{name:'Second video',exact:true}).click();await expect.poll(()=>page.evaluate(()=>player.getPlaylistIndex()),{timeout:15000}).toBe(1);await expect.poll(()=>page.evaluate(()=>player.getPlayerState()),{timeout:20000}).toBe(1);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect.poll(()=>page.evaluate(()=>player.getPlayerState())).toBe(2);
 await page.screenshot({path:'docs/design/youtube-playlist-probe.png'});
 console.log('PASS: real YouTube playlist discovery, playback, index selection and pause. Provider probe only; shared app session not yet covered.');
}catch(error){if(page)console.log('Provider state:',await page.evaluate(()=>({probe:window.probe,list:window.player?.getPlaylist(),index:window.player?.getPlaylistIndex(),state:window.player?.getPlayerState()})).catch(()=>null));console.error(error.message);process.exitCode=1;}finally{await browser.close();await server.close();}
