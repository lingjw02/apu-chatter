import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();
const observations=[];
try{
 const page=await browser.newPage();
 for(const width of [1366,375,320]){
  await page.setViewportSize({width,height:930});
  for(const path of ['/login','/register','/groups']){
   await page.goto('https://apu-chatter.pages.dev'+path);
   if(path==='/groups')await page.getByRole('heading',{name:'Sign in to your corner.',exact:true}).waitFor();else await page.locator('.auth-panel h2').waitFor();
   observations.push({width,path,url:page.url(),headings:await page.locator('h1,h2').allTextContents(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
   await page.screenshot({path:`qa-run/2026-10-01/evidence/public-${path.slice(1)}-${width}.png`,animations:'disabled'});
  }
 }
 await writeFile('qa-run/2026-10-01/evidence/production-readonly.json',JSON.stringify({browser:browser.version(),observations},null,2));
 console.log('PASS: production public auth pages render, protected groups show a sign-in gate to unauthenticated users. Read-only, no emails or production writes.');
}finally{await browser.close();}
