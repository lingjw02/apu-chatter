import {createServer} from 'vite';
process.env.VITE_SUPABASE_URL='';process.env.VITE_SUPABASE_ANON_KEY='';
const server=await createServer({envDir:false,server:{host:'127.0.0.1',port:5186,strictPort:true}});await server.listen();
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
const page = await browser.newPage({viewport:{width:1440,height:1000}});
await page.goto('http://127.0.0.1:5186/demo');
await page.getByRole('button',{name:'Skip intro'}).click();
await page.getByRole('button',{name:'Choose emoji'}).click();
await page.getByRole('button',{name:'Add ✨'}).click();
await expect(page.getByRole('textbox',{name:'Message your group',exact:true})).toHaveValue('✨');
await page.getByRole('textbox',{name:'Message your group',exact:true}).fill('Reply test');
await page.locator('.message').first().hover();
await page.getByRole('button',{name:'Reply to Maya’s message'}).first().click();
await expect(page.locator('.reply-preview')).toBeVisible();
await page.getByRole('button',{name:'Send message',exact:true}).click();
await expect(page.locator('.message').last().locator('.quoted-message')).toContainText('Maya');
await page.getByRole('button',{name:'Open trip photo 1'}).click();
await page.getByRole('button',{name:'Next photo'}).click();
await expect(page.locator('.lightbox img')).toHaveAttribute('src',/photo-1519608487953/);
await page.keyboard.press('ArrowLeft');
await expect(page.locator('.lightbox img')).toHaveAttribute('src',/photo-1476514525535/);
await page.keyboard.press('Escape');
await page.getByRole('button',{name:/Alex Morgan/}).click();
await page.getByRole('button',{name:'Reduce motion'}).click();
await expect(page.locator('.app-frame')).toHaveClass(/motion-reduced/);
await page.setViewportSize({width:390,height:844});
await page.getByRole('button',{name:'Choose emoji'}).click();
await expect(page.locator('.emoji-picker')).toBeVisible();
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('Overflow');

console.log('PASS: emoji selection, reply context, keyboard photo navigation, motion control, mobile layout.');

}finally{await browser.close();await server.close();}
