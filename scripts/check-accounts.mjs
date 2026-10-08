import {createServer} from 'vite';
process.env.VITE_SUPABASE_URL='';process.env.VITE_SUPABASE_ANON_KEY='';
const server=await createServer({envDir:false,server:{host:'127.0.0.1',port:5184,strictPort:true}});await server.listen();
import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch();
try {
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5184/register');
await expect(page.getByRole('heading',{name:'Make yourself at home.'})).toBeVisible();
await page.getByLabel('Display name').fill('Test Person');
await page.getByLabel('Email address').fill('test@example.com');
await page.getByLabel('Password',{exact:true}).fill('a-valid-test-password');
await page.getByRole('button',{name:'Show password',exact:true}).click();
await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('type','text');
await page.getByRole('button',{name:'Create account',exact:true}).click();
await expect(page.getByRole('alert')).toContainText('not connected');
await page.screenshot({path:'docs/design/clubhouse-register.png',fullPage:true});
await page.goto('http://127.0.0.1:5184/login?next=https://evil.example');
await expect(page.getByRole('link',{name:'Create an account'})).toHaveAttribute('href','/register?next=%2Fgroups');
await page.getByRole('link',{name:'Forgot your password?'}).click();
await expect(page.getByRole('heading',{name:'Let’s get you back in.'})).toBeVisible();
await page.setViewportSize({width:390,height:844});
await page.goto('http://127.0.0.1:5184/login');
await page.screenshot({path:'docs/design/clubhouse-login-mobile.png',fullPage:true});
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
await page.goto('http://127.0.0.1:5184/groups');
await expect(page.getByRole('heading',{name:'Almost ready for your people.'})).toBeVisible();
if(errors.length)throw Error(errors.join('\n'));
console.log('PASS: account screens, password visibility, explicit unconfigured state, safe redirects, mobile layout; no live email/auth claims.');

}finally{await browser.close();await server.close();}
