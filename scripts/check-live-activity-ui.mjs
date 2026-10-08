import assert from 'node:assert/strict';
export async function checkLiveActivityUI(pages,expect,admin,clients,group,users){
 const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
 for(const i of [0,0,1])check(await clients[i].rpc('send_group_message',{p_group_id:group,p_client_id:crypto.randomUUID(),p_body:'Orchard planning orchard'}));
 check(await admin.from('group_messages').insert({group_id:group,author_id:users[1],client_id:crypto.randomUUID(),body:'Older synthetic conversation',created_at:new Date(Date.now()-8*86400000).toISOString()}));
 for(const page of pages){
  await page.getByRole('button',{name:'Activity',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Group activity',exact:true});
  await expect(dialog.getByRole('heading',{name:'1 day together',exact:true})).toBeVisible({timeout:20000});await expect(dialog).toContainText('2 of 2 eligible people have chatted today.');
  const ranking=dialog.getByRole('heading',{name:'Who’s been talking',exact:true}).locator('..');
  await expect(ranking.locator('li').filter({hasText:'Smoke 0'})).toContainText('3 messages');await expect(ranking.locator('li').filter({hasText:'Smoke 1'})).toContainText('1 messages');
  await dialog.getByRole('button',{name:'All time',exact:true}).click();await expect(ranking.locator('li').filter({hasText:'Smoke 1'})).toContainText('2 messages');
  await expect(dialog.locator('.activity-words')).toContainText('orchard 6');await expect(dialog).toContainText('Asia/Kuala_Lumpur');
  await expect(dialog).toContainText('No request is made when you open Activity.');await dialog.getByRole('button',{name:'Close activity',exact:true}).click();
 }
 assert.equal(check(await admin.from('ai_jobs').select('id').eq('group_id',group)).length,0,'Opening activity must not create AI requests');
 console.log('PASS: hosted two-user group activity, weekly/all-time counts, common words, two-person streak and no implicit AI request.');
}
