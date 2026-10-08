export type GroupView='chat'|'updates'|'albums'|'board'|'ai';
type Navigation={groupId:string;view:GroupView};
const key=(userId:string)=>`apu-navigation:${userId}`;
export function readNavigation(userId:string):Navigation {
 try {
  const value=JSON.parse(sessionStorage.getItem(key(userId))||'null');
  if(value&&typeof value.groupId==='string'&&['chat','updates','albums','board','ai'].includes(value.view))return value;
 } catch { /* Navigation still works when storage is unavailable. */ }
 return {groupId:'',view:'chat'};
}
export function saveNavigation(userId:string,groupId:string,view:GroupView) {
 try {sessionStorage.setItem(key(userId),JSON.stringify({groupId,view}));} catch { /* Optional convenience. */ }
}
export function readAlbumFolder(userId:string,groupId:string) {
 try {const value=sessionStorage.getItem(`apu-album:${userId}:${groupId}`);if(value&&['shared','story','chat'].includes(value))return value;} catch { /* Optional convenience. */ }
 return 'shared';
}
export function saveAlbumFolder(userId:string,groupId:string,folder:string) {
 try {sessionStorage.setItem(`apu-album:${userId}:${groupId}`,folder);} catch { /* Optional convenience. */ }
}
