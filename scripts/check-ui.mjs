import {createServer} from 'vite';
process.env.VITE_SUPABASE_URL='';process.env.VITE_SUPABASE_ANON_KEY='';
const server=await createServer({envDir:false,server:{host:'127.0.0.1',port:5185,strictPort:true}});await server.listen();
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({headless:true});
try {
const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[]; page.on('pageerror', e=>errors.push(e.message));
await mkdir('docs/design',{recursive:true});
await page.goto('http://127.0.0.1:5185/demo');
await page.waitForTimeout(800);
await page.screenshot({path:'docs/design/clubhouse-desktop.png',fullPage:true});
await page.getByRole('textbox',{name:'Message your group',exact:true}).fill('Testing our little corner');
await page.getByRole('button',{name:'Send message',exact:true}).click();
await page.getByText('Testing our little corner',{exact:true}).waitFor();
await page.getByRole('button',{name:'Stories',exact:true}).click();
await page.getByRole('heading',{name:'The little things, shared.'}).waitFor();
await page.getByRole('button',{name:'Albums',exact:true}).click();
await page.locator('.folder-row').getByRole('button',{name:'Stories',exact:true}).click();
await page.getByRole('button',{name:'Create a group',exact:true}).click();
await page.getByLabel('Group name').fill('Prototype test group');
await page.getByRole('button',{name:'Create demo group'}).click();
await page.getByRole('heading',{name:'Prototype test group',exact:true}).waitFor();
await page.getByRole('button',{name:'Toggle group activity'}).click();
if(await page.locator('.activity').isVisible()) throw new Error('Activity panel did not collapse');
await page.getByRole('button',{name:'Toggle group activity'}).click();
await page.locator('.member-row').first().click();
await page.getByRole('button',{name:'Preview accepted chat with Maya'}).click();
await page.getByLabel('Private message',{exact:true}).fill('Ephemeral test');
await page.getByRole('button',{name:'Send private message'}).click();
await page.getByText('Ephemeral test',{exact:true}).waitFor();
await page.getByRole('button',{name:'End chat'}).click();
if(await page.getByText('Ephemeral test',{exact:true}).count()) throw new Error('Closed chat still present');
await page.setViewportSize({width:390,height:844});
await page.reload(); await page.waitForTimeout(600);
await page.screenshot({path:'docs/design/clubhouse-mobile.png',fullPage:true});
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('Mobile horizontal overflow');
await page.getByRole('button',{name:'Show groups',exact:true}).click();
await page.getByRole('button',{name:/The study room/}).click();
await page.getByRole('heading',{name:'The study room',exact:true}).waitFor();
await page.getByRole('textbox',{name:'Message your group',exact:true}).fill('Mobile hello');
await page.getByRole('button',{name:'Send message',exact:true}).click();
await page.getByText('Mobile hello',{exact:true}).waitFor();
if(errors.length) throw new Error(errors.join('\n'));
console.log('PASS: desktop/mobile layout, local sending, tabs, album folders, group creation, panel toggle, private-chat deletion; no browser runtime errors.');


}finally{await browser.close();await server.close();}
