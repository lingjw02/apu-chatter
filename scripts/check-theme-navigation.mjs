import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5181,strictPort:true}});await server.listen();const browser=await chromium.launch();
try{const page=await browser.newPage();let requests=0;await page.route('https://theme-navigation.invalid/**',async route=>{requests++;await route.fulfill({body:'External page'});});await page.goto('http://127.0.0.1:5181/login');await page.evaluate(()=>{const f=document.createElement('iframe');f.sandbox.add('allow-scripts');f.srcdoc='<script>location.href="https://theme-navigation.invalid/attempt"</script>';document.body.append(f);});await page.waitForTimeout(1000);assert.equal(requests,0,'Sandbox code must not navigate its frame to an arbitrary external origin');console.log('PASS: parent CSP blocks arbitrary frame navigation from sandboxed UI code.');}finally{await browser.close();await server.close();}
