type RecordEntry={id:string;created_at:string;state:string};
export function contentCursor(item:Pick<RecordEntry,'id'|'created_at'>){return `created_at.lt.${item.created_at},and(created_at.eq.${item.created_at},id.lt.${item.id})`;}
export function mergeContent<T extends RecordEntry>(old:T[],incoming:T[]):T[]{const map=new Map(old.map(item=>[item.id,item]));for(const item of incoming){if(item.state==='live')map.set(item.id,item);else map.delete(item.id);}return [...map.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));}
