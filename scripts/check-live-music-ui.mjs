// User-approved pilot: Spotify queue links open externally; no Spotify embeds.
export async function checkLiveMusicUI(pages,expect){
 const requests=[];
 for(const page of pages){page.on('request',r=>{if(new URL(r.url()).hostname==='open.spotify.com')requests.push(r.url());});await page.reload();await expect(page.getByRole('heading',{name:'Temporary integration check',exact:true})).toBeVisible({timeout:20000});await page.getByRole('button',{name:/Music box/}).click();await page.getByRole('button',{name:'Join listening',exact:true}).click();await expect(page.getByRole('button',{name:'Leave listening',exact:true})).toBeVisible();}
 const host=pages[0];
 for(const [kind,id] of [['track','2Foc5Q5nqNiosCNqttzHof'],['playlist','37i9dQZF1DXcBWIGoYBM5M']]){
  const url='https://open.spotify.com/'+kind+'/'+id;
  await host.getByLabel('Song or playlist link',{exact:true}).fill(url);await host.getByRole('button',{name:'Check link',exact:true}).click();await host.getByLabel('Queue label',{exact:true}).fill('External Spotify '+kind);await host.getByRole('button',{name:'Add to this group’s queue',exact:true}).click();
  for(const page of pages){await expect(page.getByRole('link',{name:'Open on Spotify',exact:true})).toHaveAttribute('href',url,{timeout:15000});await expect(page.getByRole('link',{name:'Open on Spotify',exact:true})).toHaveAttribute('target','_blank');await expect(page.locator('.music-body iframe[src*="spotify"]')).toHaveCount(0);await expect(page.getByRole('button',{name:'Play for group',exact:true})).toHaveCount(0);await expect(page.getByLabel('Seek seconds',{exact:true})).toHaveCount(0);await expect(page.getByText('Spotify playback opens in Spotify. Your group shares the queue and skip votes; playback is individual.',{exact:true})).toBeVisible();}
  for(const page of pages)await page.getByRole('button',{name:/^Vote to skip/}).click();
  for(const page of pages)await expect(page.locator('.music-queue li')).toHaveCount(0,{timeout:15000});
 }
 if(requests.length)throw Error('External-only Spotify loaded provider resources without following a link');
 for(const page of pages){await page.getByRole('button',{name:'Leave listening',exact:true}).click();await page.getByRole('button',{name:/Music box/}).click();}
 console.log('PASS: hosted two-user Spotify track/playlist external links, no embed/host playback controls/provider requests, and majority skip votes.');
}
