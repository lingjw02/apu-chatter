import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5183,strictPort:true}});
await server.listen();const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5183/login');
 const result=await page.evaluate(async()=>{
  Object.defineProperty(window,'AudioContext',{value:undefined,configurable:true});
  const {enableAudio}=await import('/src/features/personalization/audio.ts');
  try{await enableAudio();return 'unexpected success';}catch(e){return e.message;}
 });
 assert.equal(result,'This browser does not support notification sounds. Try a browser with Web Audio support.');
 console.log('PASS: unavailable Web Audio produces an actionable error.');
}finally{await browser.close();await server.close();}
