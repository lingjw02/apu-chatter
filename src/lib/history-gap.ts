/** A full, disconnected latest page cannot safely be merged across a gap. */
export function refreshHasGap(previous:readonly {id:string}[],incoming:readonly {id:string}[],pageSize:number){
 if(!previous.length||incoming.length<pageSize)return false;
 const ids=new Set(previous.map(row=>row.id));
 return !incoming.some(row=>ids.has(row.id));
}
