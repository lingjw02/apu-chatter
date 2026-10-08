export async function checkLiveAppleUI(pages,expect){
 for(const page of pages){
  await page.addInitScript(()=>{window.__playedMedia=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(!window.__playedMedia.includes(this))window.__playedMedia.push(this);return play.apply(this,args);};});
  await page.reload();await expect(page.getByRole('heading',{name:'Temporary integration check',exact:true})).toBeVisible({timeout:20000});await page.getByRole('button',{name:/Music box/}).click();await page.getByRole('button',{name:'Join listening',exact:true}).click();await expect(page.getByRole('button',{name:'Leave listening',exact:true})).toBeVisible();
 }
 const host=pages[0];
 await host.getByLabel('Song or playlist link',{exact:true}).fill('https://music.apple.com/my/album/617154241?i=617154366');await host.getByRole('button',{name:'Check link',exact:true}).click();await host.getByLabel('Queue label',{exact:true}).fill('Apple independent preview');await host.getByRole('button',{name:'Add to this group’s queue',exact:true}).click();
 const frames=[];
 for(const page of pages){
  await expect(page.locator('iframe[title="apple track"]')).toBeVisible({timeout:15000});await expect(page.getByRole('button',{name:'Play for group',exact:true})).toHaveCount(0);
  await page.frameLocator('iframe[title="apple track"]').getByRole('button',{name:/^play$/i}).first().click({timeout:30000});
  const frame=page.frames().find(f=>f.url().startsWith('https://embed.music.apple.com/'));if(!frame)throw Error('Apple embed frame unavailable');frames.push(frame);
  await expect.poll(()=>frame.evaluate(()=>window.__playedMedia.some(m=>!m.paused&&m.currentTime>1)),{timeout:20000}).toBe(true);
 }
 await host.frameLocator('iframe[title="apple track"]').getByRole('button',{name:/^pause$/i}).first().click();
 await expect.poll(()=>frames[0].evaluate(()=>window.__playedMedia.every(m=>m.paused))).toBe(true);
 const before=await frames[1].evaluate(()=>Math.max(...window.__playedMedia.map(m=>m.currentTime)));
 await expect.poll(()=>frames[1].evaluate(()=>Math.max(...window.__playedMedia.filter(m=>!m.paused).map(m=>m.currentTime))),{timeout:10000}).toBeGreaterThan(before+1);
 if(await pages[1].evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Apple mobile viewport overflow');
 await pages[1].screenshot({path:'docs/design/apple-hosted-mobile.png'});
 for(const page of pages){await page.getByRole('button',{name:'Leave listening',exact:true}).click();await expect(page.locator('iframe[title="apple track"]')).toHaveCount(0);await page.getByRole('button',{name:/Music box/}).click();}
 console.log('PASS: hosted two-user Apple preview playback, independent pause, mobile viewport bounds and embed removal on leave. Full-song and physical mobile not asserted.');
}
