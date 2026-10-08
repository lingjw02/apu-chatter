export type MusicLink={provider:'youtube'|'spotify'|'apple';kind:'track'|'playlist';external_id:string};
export function parseMusicLink(value:string):MusicLink{
 let url:URL;try{url=new URL(value.trim());}catch{throw Error('Paste a full YouTube, Spotify or supported Apple Music song link.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Use a secure, unmodified provider link.');
 const host=url.hostname.toLowerCase().replace(/^www\./,'');
 if(host==='youtube.com'||host==='m.youtube.com'||host==='youtu.be'){
  const track=host==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v')||(/^\/(?:shorts|embed)\/([\w-]+)$/.exec(url.pathname)?.[1]);
  if(track&&/^[\w-]{11}$/.test(track))return {provider:'youtube',kind:'track',external_id:track};
  const list=url.searchParams.get('list');if(list&&/^[\w-]{10,100}$/.test(list))return {provider:'youtube',kind:'playlist',external_id:list};
 }
 if(host==='open.spotify.com'){const match=/^\/(?:intl-[a-z]+\/)?(track|playlist)\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);if(match)return {provider:'spotify',kind:match[1] as 'track'|'playlist',external_id:match[2]};}
 if(host==='music.apple.com'){const match=/^\/(my|us|gb|au|sg|in)\/album\/(?:[^/]+\/)?([1-9][0-9]{0,15})\/?$/.exec(url.pathname),track=url.searchParams.get('i');if(match&&track&&/^[1-9][0-9]{0,15}$/.test(track))return {provider:'apple',kind:'track',external_id:`${match[1]}:${match[2]}:${track}`};}
 throw Error('This link is not supported in the music box. Share it as a normal chat link instead.');
}
export function providerURL(item:MusicLink){if(item.provider==='apple'){const [country,album,track]=item.external_id.split(':');return `https://music.apple.com/${country}/album/${album}?i=${track}`;}return item.provider==='spotify'?`https://open.spotify.com/${item.kind}/${item.external_id}`:item.kind==='playlist'?`https://www.youtube.com/playlist?list=${item.external_id}`:`https://www.youtube.com/watch?v=${item.external_id}`;}
