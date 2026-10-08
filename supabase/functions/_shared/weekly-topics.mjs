// Model output is data. Only actual context message IDs can support a topic.
export function parseWeeklyResult(output, sourceIds) {
 const text=output.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 const value=JSON.parse(text);
 if(!value||typeof value.summary!=='string'||!value.summary.trim()||!Array.isArray(value.topics))throw Error('Invalid weekly result');
 const allowed=new Set(sourceIds),labels=new Set(),topics=[];
 for(const item of value.topics.slice(0,20)){
  if(!item||typeof item.label!=='string'||!Array.isArray(item.sources))continue;
  const label=item.label.trim().slice(0,80),key=label.toLowerCase();
  const sources=[...new Set(item.sources.filter(id=>typeof id==='string'&&allowed.has(id)))];
  if(!label||labels.has(key)||!sources.length)continue;
  labels.add(key);topics.push({label,sources});
 }
 topics.sort((a,b)=>b.sources.length-a.sources.length||a.label.localeCompare(b.label));
 return {summary:value.summary.trim().slice(0,12000),topics:topics.slice(0,5)};
}
