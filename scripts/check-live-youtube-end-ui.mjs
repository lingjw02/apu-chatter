export async function checkLiveYouTubeEndUI(pages,expect){
 for(const page of pages){
  await page.addInitScript(()=>{window.onYouTubeIframeAPIReady=()=>{window.YT.Player=new Proxy(window.YT.Player,{construct(Target,args){const p=Reflect.construct(Target,args);window.__singleVideo=p;return p;}});};});
  await page.reload();await expect(page.getByRole('heading',{name:'Temporary integration check',exact:true})).toBeVisible({timeout:20000});
  await page.getByRole('button',{name:/Music box/}).click();await page.getByRole('button',{name:'Join listening',exact:true}).click();await expect(page.getByRole('button',{name:'Leave listening',exact:true})).toBeVisible();
 }
 const host=pages[0];
 for(const label of ['First completion check','Second completion check']){
  await host.getByLabel('Song or playlist link',{exact:true}).fill('https://youtu.be/M7lc1UVf-VE');await host.getByRole('button',{name:'Check link',exact:true}).click();await host.getByLabel('Queue label',{exact:true}).fill(label);await host.getByRole('button',{name:'Add to this group’s queue',exact:true}).click();
  await expect(host.locator('.music-queue')).toContainText(label);await expect(host.getByLabel('Song or playlist link',{exact:true})).toHaveValue('');
 }
 await expect.poll(()=>host.evaluate(()=>window.__singleVideo?.getDuration?.()||0),{timeout:30000}).toBeGreaterThan(1);
 await host.getByRole('button',{name:'Play for group',exact:true}).click();await expect.poll(()=>host.evaluate(()=>window.__singleVideo.getPlayerState()),{timeout:20000}).toBe(1);
 const duration=await host.evaluate(()=>window.__singleVideo.getDuration());await host.getByLabel('Seek seconds',{exact:true}).fill(String(Math.max(0,duration-1)));await host.getByRole('button',{name:'Seek',exact:true}).click();
 for(const page of pages){await expect(page.locator('.music-now strong')).toHaveText('Second completion check',{timeout:25000});await expect(page.locator('.music-queue li')).toHaveCount(1);}
 await host.getByRole('button',{name:'Pause for group',exact:true}).click();
 for(const page of pages){await page.getByRole('button',{name:'Leave listening',exact:true}).click();await page.getByRole('button',{name:/Music box/}).click();}
 console.log('PASS: hosted host natural YouTube ending advances exactly one queue item observed by both signed-in users. Listener audio and physical mobile not asserted.');
}
