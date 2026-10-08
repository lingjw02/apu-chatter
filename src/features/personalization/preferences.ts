export type Theme={accent:string;background:string;bubble:string;text:string;radius:number;fontSize:number};
export const defaultTheme:Theme={accent:'#076371',background:'#ffffff',bubble:'#e3f2ef',text:'#243438',radius:16,fontSize:14};
export function validateTheme(value:unknown):Theme{
 if(!value||typeof value!=='object')throw Error('Choose a valid theme file.');
 const v=value as Record<string,unknown>,result={...defaultTheme};
 for(const key of ['accent','background','bubble','text'] as const){if(typeof v[key]!=='string'||!/^#[\da-f]{6}$/i.test(v[key]))throw Error('Colors must use six-digit hex values.');result[key]=v[key];}
 for(const [key,min,max] of [['radius',0,32],['fontSize',12,20]] as const){if(typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<min||v[key]>max)throw Error(`${key} must be between ${min} and ${max}.`);result[key]=v[key];}
 return result;
}
export const themeSelectors=['.bubble','.group-header','.tabs-row','.tabs-row button','.composer','.composer input','.send-btn','.sharing-panel','.board-panel','.music-room','.voice-room','.music-toggle','.board-tools','.group-item','.group-icon','.sharing-open','.board-tabs button','.board-tools button','.music-session-controls button','.music-add input','.music-queue','.voice-actions button','.voice-toggle','.ai-actions button','.ai-result','.ai-sources button'];
const selectors=new Set(themeSelectors);
const sidebar=new Set(['.group-item','.group-icon']);
export function compileThemeCSS(source:string):string{
 if(source.length>12000)throw Error('Keep CSS under 12,000 characters.');
 let remaining=source.trim(),output='';
 while(remaining){const block=/^(\.[a-z-]+(?: (?:button|input))?)(:(?:hover|focus-visible|active))?\s*\{([^{}]*)\}\s*/.exec(remaining);if(!block||!selectors.has(block[1]))throw Error('Use a supported theme selector; account and recovery controls cannot be styled.');
 const declarations=block[3].split(';').map(s=>s.trim()).filter(Boolean).map(item=>{
  const match=/^([a-z-]+)\s*:\s*(.*?)$/.exec(item);if(!match)throw Error('Each declaration needs a property and value.');const [,property,value]=match;
  const spacing=/^(?:[0-9]|1[0-9]|2[0-4])px(?: (?:[0-9]|1[0-9]|2[0-4])px){0,3}$/;
  const valid=(['color','background-color','border-color'].includes(property)&&/^#[\da-f]{6}$/i.test(value))||(property==='border-radius'&&/^(?:[0-9]|[12][0-9]|3[0-2])px$/.test(value))||(property==='font-size'&&/^(?:1[2-9]|20)px$/.test(value))||(property==='font-weight'&&/^[4-8]00$/.test(value))||(['padding','gap'].includes(property)&&spacing.test(value))||(property==='line-height'&&/^(?:1\.[2-9]|2(?:\.[0-2])?)$/.test(value))||(property==='border-width'&&/^[0-4]px$/.test(value))||(property==='border-style'&&/^(solid|dashed|dotted)$/.test(value))||(property==='text-align'&&/^(left|center|right)$/.test(value))||(property==='flex-direction'&&/^(row|column)$/.test(value))||(property==='justify-content'&&/^(flex-start|center|space-between)$/.test(value))||(property==='transition'&&/^(color|background-color|border-color|transform) (100|150|200|250)ms ease$/.test(value))||(property==='transform'&&/^(none|translateY\(-?[12]px\))$/.test(value))||(property==='animation'&&/^chatter-theme-(fade|arrive) (150|200|250)ms ease$/.test(value));
  if(!valid)throw Error(`Unsupported ${property} value. Use bounded presentation styles from the editor guide.`);return `${property}:${value}`;
 });const target=`.connected-app > .${sidebar.has(block[1])?'sidebar':'main-area'} ${block[1]}${block[2]||''}`;output+=`${target}{${declarations.join(';')}}\n@media(prefers-reduced-motion:reduce){${target}{transition:none!important;animation:none!important;transform:none!important}}\n`;remaining=remaining.slice(block[0].length).trim();
 }return output;
}
export function themeCSS(t:Theme){return `.connected-app > .main-area{background:${t.background};color:${t.text}}.connected-app > .main-area .bubble{background:${t.bubble};color:${t.text};border-radius:${t.radius}px;font-size:${t.fontSize}px}.connected-app > .main-area .send-btn{background:${t.accent}}.connected-app > .main-area .tabs-row button.active{color:${t.accent};border-color:${t.accent}}`;}
export const themeKey=(user:string)=>`chatter:theme:${user}`;
export type SoundPreferences={muted:boolean;senders:Record<string,string>};
export const soundKey=(user:string,group:string)=>`chatter:sounds:${user}:${group}`;
export function soundFor(p:SoundPreferences,sender:string){return p.muted?'silent':p.senders[sender]||'chime';}
export function readSounds(user:string,group:string):SoundPreferences{try{const p=JSON.parse(localStorage.getItem(soundKey(user,group))||'{}');return {muted:p.muted===true,senders:p.senders&&typeof p.senders==='object'?p.senders:{}};}catch{return {muted:false,senders:{}};}}
export function shouldNotify(m:{author_id?:string;created_at?:string;deleted_at?:string|null},user:string,since:number){return !!m.author_id&&m.author_id!==user&&!m.deleted_at&&Date.parse(m.created_at||'')>=since;}
