// Explicit free-only choices; no automatic fallback to a paid model.
const allowed=new Set(['openrouter/free','qwen/qwen3.8-27b:free']);
export function freeModel(value){return typeof value==='string'&&allowed.has(value)?value:null;}
export async function requestFreeCompletion(key,model,payload,fetcher=fetch,fallback=null){
 if(!freeModel(model)||(fallback&&!freeModel(fallback)))throw Error('Unsupported free model');
 const models=[model,...(fallback&&fallback!==model?[fallback]:[])];
 for(let i=0;i<models.length;i++){
  let response;
  try{response=await fetcher('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','X-Title':'APU Chatter'},body:JSON.stringify({...payload,model:models[i]}),signal:AbortSignal.timeout(40000)});}
  catch(error){if(i+1<models.length)continue;throw error;}
  if(i+1<models.length&&[404,429,500,502,503,504].includes(response.status)){await response.body?.cancel();continue;}
  return response;
 }
 throw Error('Free provider unavailable');
}
