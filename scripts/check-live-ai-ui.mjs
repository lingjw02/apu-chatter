// Real hosted free-model request and source navigation; no fabricated AI result.
import assert from 'node:assert/strict';
export async function checkLiveAIUI(pages,expect,admin,clients,group){
 const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
 const body='Our synthetic study group decided to meet Friday at 3 PM in the library. Bring a notebook.';
 const message=check(await clients[0].rpc('send_group_message',{p_group_id:group,p_client_id:crypto.randomUUID(),p_body:body}));
 const [owner,reader]=pages;
 await owner.getByRole('button',{name:'AI',exact:true}).click();
 await expect(owner.getByRole('button',{name:'Catch me up',exact:true})).toBeDisabled();
 await owner.getByRole('button',{name:'Enable group AI',exact:true}).click();
 const consent=owner.getByRole('dialog',{name:'Enable group AI',exact:true});await expect(consent).toContainText('OpenRouter');await consent.getByRole('button',{name:'Keep AI off',exact:true}).click();await expect(owner.getByRole('button',{name:'Catch me up',exact:true})).toBeDisabled();
 await owner.getByRole('button',{name:'Enable group AI',exact:true}).click();await consent.getByRole('button',{name:'Enable group AI',exact:true}).click();await expect(consent).toHaveCount(0,{timeout:20000});
 await owner.getByLabel('Conversation range',{exact:true}).selectOption('1');
 await owner.getByRole('button',{name:'Catch me up',exact:true}).click();
 await expect(owner.locator('.ai-result')).toContainText('done',{timeout:90000});
 const job=check(await admin.from('ai_jobs').select('id,state,result,sources').eq('group_id',group).eq('kind','summary').single());assert.equal(job.state,'done');assert.ok(job.result.trim());assert.ok(job.sources.includes(message));
 await reader.getByRole('button',{name:'AI',exact:true}).click();await expect(reader.locator('.ai-result')).toContainText(job.result,{timeout:20000});await expect(reader.getByRole('button',{name:'Turn off group AI',exact:true})).toHaveCount(0);
 await reader.locator('.ai-result summary').click();const source=reader.locator('.ai-sources button').nth(job.sources.indexOf(message));await source.click();const dialog=reader.getByRole('dialog',{name:'Summary source message',exact:true});await expect(dialog).toContainText(body,{timeout:20000});await reader.getByRole('button',{name:'Close source message',exact:true}).click();
 check(await admin.from('group_messages').update({deleted_at:new Date().toISOString(),body:'[deleted]'}).eq('id',message));
 await source.click();await expect(dialog).toContainText('This source message was deleted or is no longer available.');await expect(dialog).not.toContainText(body);await reader.getByRole('button',{name:'Close source message',exact:true}).click();
 await owner.getByRole('button',{name:'Turn off group AI',exact:true}).click();await expect(owner.getByRole('button',{name:'Catch me up',exact:true})).toBeDisabled({timeout:20000});
 for(const page of pages)await page.getByRole('button',{name:'Chat',exact:true}).click();
 console.log('PASS: hosted AI consent/cancel, real free-provider summary for selected 24-hour range, member result/source navigation, deleted-source exclusion and owner disable.');
}
