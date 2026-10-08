export function buildContext(rows) {
 let budget=6000,partial=rows.length>200;const selected=[];
 for(const row of rows.slice(0,200)){
  const body=String(row.body).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email omitted]').replace(/\b(?:sk-[a-z0-9_-]+|rqsty-sk-[a-z0-9+/=]+|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)\b/gi,'[credential omitted]').replace(/\b(password|secret|api[_ -]?key)\s*[:=]\s*\S+/gi,'[credential omitted]');
  const line=JSON.stringify({id:row.id,text:body});const size=new TextEncoder().encode(line).length;
  if(size>budget){partial=true;break;}budget-=size;selected.push({id:row.id,text:body});
 }
 return {text:JSON.stringify(selected.reverse()),sources:selected.map(r=>r.id),partial};
}
