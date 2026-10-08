import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const secrets=new Set();
for(const name of await readdir('.')){
 if(!/^\.env(?:\.|$)/.test(name)||name.endsWith('.example'))continue;
 for(const line of (await readFile(name,'utf8')).split(/\r?\n/)){
  const match=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(!match)continue;
  const [,key,raw]=match;
  if(key==='VITE_SUPABASE_ANON_KEY'||!/(?:SECRET|TOKEN|PASSWORD|PASS|API_KEY|SERVICE_ROLE)/.test(key))continue;
  const value=raw.trim().replace(/^(['"])(.*)\1$/,'$2');
  if(value.length>=16)secrets.add(value);
 }
}
if(!secrets.size)throw Error('No local secret values available; scan cannot establish coverage');
let files=0;
async function scan(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())await scan(file);
  else if(entry.isFile()){
   const content=await readFile(file);files++;
   for(const value of secrets)if(content.includes(Buffer.from(value)))throw Error('A local secret value appears in build file: '+file);
  }
 }
}
await scan('dist');
console.log(`PASS: ${files} build files contain none of ${secrets.size} local private environment values. Raw-value scan only; public Supabase anon key intentionally allowed. No secret values printed.`);
