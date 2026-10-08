import assert from 'node:assert/strict';
export async function checkLiveMessageRecovery(pages,expect,admin,group){
 const [peer,mobile]=pages,composer=mobile.getByRole('textbox',{name:'Message your group',exact:true}),send=mobile.getByRole('button',{name:'Send message',exact:true});
 const body='Hosted mobile recovery '+crypto.randomUUID(),attempts=[];
 const pattern='**/rest/v1/rpc/send_group_message';let loseAcknowledgement=true;
 const rows=async()=>{const r=await admin.from('group_messages').select('id,client_id').eq('group_id',group).eq('body',body);if(r.error)throw Error(r.error.message);return r.data;};
 const onRequest=request=>{if(request.url().endsWith('/rpc/send_group_message'))attempts.push(request.postDataJSON().p_client_id);};mobile.on('request',onRequest);
 try{
  await composer.fill(body);await mobile.context().setOffline(true);
  const failed=mobile.waitForEvent('requestfailed',{predicate:r=>r.url().endsWith('/rpc/send_group_message'),timeout:15000});await send.click();await failed;await expect(send).toBeEnabled();await expect(composer).toHaveValue(body);assert.equal((await rows()).length,0);
  await mobile.context().setOffline(false);
  // The real backend commits, but the sender receives a simulated lost response.
  await mobile.route(pattern,async route=>{if(!loseAcknowledgement){await route.continue();return;}loseAcknowledgement=false;const response=await route.fetch();assert.ok(response.ok());await route.fulfill({status:503,json:{message:'Synthetic lost message acknowledgement'}});});
  await send.click();await expect(mobile.getByText('Synthetic lost message acknowledgement',{exact:true})).toBeVisible({timeout:20000});await expect(composer).toHaveValue(body);assert.equal((await rows()).length,1);
  await expect(peer.getByText(body,{exact:true})).toBeVisible({timeout:20000});
  await send.click();await expect(composer).toHaveValue('',{timeout:20000});await expect(mobile.getByText(body,{exact:true})).toHaveCount(1);await expect(peer.getByText(body,{exact:true})).toHaveCount(1);
  const saved=await rows();assert.equal(saved.length,1);assert.equal(attempts.length,3);assert.equal(new Set(attempts).size,1);assert.equal(saved[0].client_id,attempts[0]);
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS: hosted mobile offline send, retained draft, lost acknowledgement after real commit, stable retry ID and exactly one row/message in both browsers.');
 }finally{await mobile.context().setOffline(false);await mobile.unroute(pattern);mobile.off('request',onRequest);}
}
