export type Point=[number,number];
export type Drawing={kind:'pen'|'highlight'|'text';color:string;width:number;points?:Point[];x?:number;y?:number;text?:string};
export type Shape={id:string;tab_id:string;data:Drawing;revision:number;deleted:boolean;updated_by?:string};
export type PendingWrite={id:string;tab_id:string;actor_id:string;before:Shape|null;data:Drawing;deleted:boolean};
function sameDrawing(a:Drawing,b:Drawing){return a.kind===b.kind&&a.color===b.color&&a.width===b.width&&a.x===b.x&&a.y===b.y&&a.text===b.text&&JSON.stringify(a.points)===JSON.stringify(b.points);}
export function reconcileWrite(edit:PendingWrite,remote:Shape|null):'retry'|'acknowledged'|'conflict'{
 const base=edit.before?.revision||0;
 if(!remote)return base===0?'retry':'conflict';
 if(remote.id!==edit.id||remote.tab_id!==edit.tab_id)return 'conflict';
 if(remote.revision===base+1&&remote.updated_by===edit.actor_id&&remote.deleted===edit.deleted&&sameDrawing(remote.data,edit.data))return 'acknowledged';
 return remote.revision===base?'retry':'conflict';
}
