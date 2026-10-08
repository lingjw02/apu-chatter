export async function checkLivePlaylistUI(pages,expect){
 for(const page of pages){
  await page.addInitScript(()=>{window.__playlistDestroyed=false;window.onYouTubeIframeAPIReady=()=>{window.YT.Player=new Proxy(window.YT.Player,{construct(Target,args){const p=Reflect.construct(Target,args),destroy=p.destroy.bind(p);p.destroy=()=>{window.__playlistDestroyed=true;destroy();};window.__livePlaylist=p;return p;}});};});
  await page.reload();await expect(page.getByRole('heading',{name:'Temporary integration check',exact:true})).toBeVisible({timeout:20000});await page.getByRole('button',{name:/Music box/}).click();await page.getByRole('button',{name:'Join listening',exact:true}).click();await expect(page.getByRole('button',{name:'Leave listening',exact:true})).toBeVisible();
 }
 const host=pages[0],listener=pages[1];
 await host.getByLabel('Song or playlist link',{exact:true}).fill('https://www.youtube.com/playlist?list=PLUl4u3cNGP63EdVPNLG3ToM6LaEUuStEY');await host.getByRole('button',{name:'Check link',exact:true}).click();await host.getByLabel('Queue label',{exact:true}).fill('Live shared playlist');await host.getByRole('button',{name:'Add to this group’s queue',exact:true}).click();
 for(const page of pages)await expect.poll(()=>page.evaluate(()=>window.__livePlaylist?.getPlaylist?.()?.length||0),{timeout:30000}).toBeGreaterThan(3);
 await host.getByRole('button',{name:'Play for group',exact:true}).click();for(const page of pages)await page.getByRole('button',{name:'Enable playlist audio',exact:true}).click();
 for(const page of pages)await expect.poll(()=>page.evaluate(()=>window.__livePlaylist.getPlayerState()),{timeout:20000}).toBe(1);
 await host.getByRole('button',{name:'Next playlist track',exact:true}).click();
 for(const page of pages)await expect.poll(()=>page.evaluate(()=>window.__livePlaylist.getPlaylistIndex()),{timeout:15000}).toBe(1);
 {const video=await host.evaluate(()=>window.__livePlaylist.getVideoData().video_id);await expect.poll(()=>listener.evaluate(()=>window.__livePlaylist.getVideoData().video_id),{timeout:10000}).toBe(video);}
 await host.getByRole('button',{name:'Pause for group',exact:true}).click();for(const page of pages)await expect.poll(()=>page.evaluate(()=>window.__livePlaylist.getPlayerState()),{timeout:10000}).toBe(2);
 await host.evaluate(()=>window.__livePlaylist.playVideoAt(2));for(const page of pages)await expect.poll(()=>page.evaluate(()=>window.__livePlaylist.getPlaylistIndex()),{timeout:15000}).toBe(2);
 await expect.poll(()=>host.evaluate(()=>window.__livePlaylist.getDuration()),{timeout:10000}).toBeGreaterThan(1);
 const duration=await host.evaluate(()=>window.__livePlaylist.getDuration());await host.getByLabel('Seek seconds',{exact:true}).fill(String(Math.max(0,Math.floor(duration)-1)));await host.getByRole('button',{name:'Seek',exact:true}).click();await host.getByRole('button',{name:'Play for group',exact:true}).click();
 for(const page of pages)await expect.poll(()=>page.evaluate(()=>window.__livePlaylist.getPlaylistIndex()),{timeout:25000}).toBe(3);
 for(const page of pages)await expect.poll(()=>page.evaluate(()=>window.__livePlaylist.getPlayerState()===1&&window.__livePlaylist.getCurrentTime()>0.5),{timeout:20000}).toBe(true);
 await host.getByRole('button',{name:'Leave listening',exact:true}).click();await expect.poll(()=>host.evaluate(()=>window.__playlistDestroyed)).toBe(true);
 await expect(listener.getByRole('button',{name:'Previous playlist track',exact:true})).toBeVisible({timeout:20000});await expect.poll(()=>listener.evaluate(()=>window.__livePlaylist.getPlaylistIndex())).toBe(3);
 await listener.screenshot({path:'docs/design/youtube-playlist-hosted-mobile.png'});if(await listener.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Playlist mobile overflow');
 await listener.getByRole('button',{name:'Leave listening',exact:true}).click();await expect.poll(()=>listener.evaluate(()=>window.__playlistDestroyed)).toBe(true);for(const page of pages)await page.getByRole('button',{name:/Music box/}).click();
 console.log('PASS: hosted two-user YouTube playlist playback, app/native selection, video-ID agreement, pause, natural advance, host succession and leave cleanup. Chromium desktop/mobile viewports; physical mobile not covered.');
}
