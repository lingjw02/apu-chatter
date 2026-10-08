import assert from 'node:assert/strict';
export async function checkLivePrivateUI(pages,expect,admin,group){
 for(const ender of [0,1]){
  for(const page of pages)await page.getByRole('button',{name:/^Private chats/}).click();
  await pages[0].getByRole('button',{name:'Request chat with Smoke 1',exact:true}).click();
  await expect(pages[0].getByText('Waiting for acceptance',{exact:true})).toBeVisible();
  for(const page of pages)await expect(page.getByLabel('Private message',{exact:true})).toHaveCount(0);
  await pages[1].getByRole('button',{name:'Accept',exact:true}).click();
  await pages[0].getByRole('button',{name:'Open',exact:true}).click();
  const chat=await admin.from('private_chats').select('id').eq('group_id',group).eq('state','open').single();assert.ifError(chat.error);
  for(let i=0;i<2;i++){
   const text=`Temporary acceptance check ${ender}:${i}`;
   await pages[i].getByLabel('Private message',{exact:true}).fill(text);await pages[i].getByRole('button',{name:'Send private message',exact:true}).click();
   for(const page of pages)await expect(page.getByText(text,{exact:true})).toBeVisible({timeout:15000});
  }
  await pages[1-ender].getByLabel('Private message',{exact:true}).fill('Unsent temporary draft');
  await pages[ender].getByRole('button',{name:'End conversation',exact:true}).click();await pages[ender].getByRole('button',{name:'Keep chatting',exact:true}).click();
  await expect(pages[ender].locator('.private-message')).toHaveCount(2);
  await pages[ender].getByRole('button',{name:'End conversation',exact:true}).click();await pages[ender].getByRole('button',{name:'End and delete',exact:true}).click();
  for(const page of pages){await expect(page.getByRole('heading',{name:'This conversation has ended.',exact:true})).toBeVisible({timeout:15000});await expect(page.locator('.private-message')).toHaveCount(0);await expect(page.getByLabel('Private message',{exact:true})).toHaveCount(0);}
  const rows=await admin.from('private_messages').select('id',{count:'exact',head:true}).eq('chat_id',chat.data.id);assert.ifError(rows.error);assert.equal(rows.count,0,'Closed chat bodies must be deleted, not just hidden');
  for(const page of pages)await page.getByRole('button',{name:'Close private chats panel',exact:true}).click();
 }
 console.log('PASS: hosted two-user private request/accept, bidirectional text, cancelled closure, closure by either participant, both-client clearing and physical row deletion.');
}
