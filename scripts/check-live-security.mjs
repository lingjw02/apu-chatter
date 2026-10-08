import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

// Fixed arguments only: SQL lives in a file, never interpolated through a shell.
const stdout=execFileSync(process.platform==='win32'?'npx.cmd':'npx',['supabase','db','query','--linked','--file','scripts/security-catalog.sql','--output','json'],{encoding:'utf8',shell:process.platform==='win32',stdio:['ignore','pipe','pipe']});
const result=JSON.parse(stdout.slice(stdout.indexOf('{'),stdout.lastIndexOf('}')+1));
const audit=result.rows[0].audit;
const serviceOnly=new Set(['ai_job_context','avatar_cleanup_batch','claim_ai_job','claim_weekly_ai','complete_ai_job','complete_weekly_ai','finish_avatar_cleanup','finish_media_cleanup','media_cleanup_batch']);
const userRPC=new Set('allow_reentry blocked_accounts cast_kick_vote claim_voice_ice close_private_chat confirm_media_removed create_board_tab create_group create_invite delete_content delete_group delete_group_message group_activity group_weekly_topics heartbeat_voice join_group join_voice lease_board_text leave_group leave_voice mark_content_seen music_action music_state music_library load_music_queue set_music_reaction resume_music publish_avatar publish_media remove_avatar remove_member rename_board_tab report_member request_ai_job request_ai_job_range request_private_chat reserve_avatar reserve_media resolve_report respond_private_chat revoke_invite send_group_message send_private_message send_voice_signal set_group_ai set_member_block set_member_role start_kick_vote transfer_ownership write_board_shape'.split(' '));
for(const fn of audit.functions){
 assert.ok(serviceOnly.has(fn.name)||userRPC.has(fn.name),'Unreviewed privileged RPC: '+fn.signature);
 assert.equal(fn.anon,false,'Anonymous RPC access: '+fn.signature);
 assert.ok(fn.config?.includes('search_path=""'),'Mutable function search path: '+fn.signature);
 assert.equal(fn.authenticated,userRPC.has(fn.name),'Unexpected user grant: '+fn.signature);
 if(serviceOnly.has(fn.name))assert.equal(fn.service,true,'Missing worker grant: '+fn.signature);
}
assert.equal(new Set(audit.functions.map(f=>f.name)).size,serviceOnly.size+userRPC.size,'A reviewed RPC is missing');
for(const table of audit.tables){
 const name=table.schema+'.'+table.name;
 assert.equal(table.rls,true,'RLS disabled: '+name);assert.equal(table.anon,false,'Anonymous table grant: '+name);
 assert.equal(table.user_insert,false,'Direct insert grant: '+name);assert.equal(table.user_truncate,false,'Direct truncate grant: '+name);
 assert.equal(table.user_update,name==='public.profiles','Direct update grant: '+name);
 assert.equal(table.user_delete,name==='public.voice_signals','Direct delete grant: '+name);
 if(table.schema==='private')assert.equal(table.user_read,false,'Private table readable: '+name);
}
assert.deepEqual(audit.profile_update_columns.sort(),['bio','display_name','status']);
for(const policy of audit.storage_policies)if(['ALL','INSERT','UPDATE'].includes(policy.command))assert.ok(!policy.roles.some(r=>['public','anon','authenticated'].includes(r)),'Storage write policy bypasses server validation: '+policy.name);
assert.deepEqual(audit.buckets.map(b=>b.id).sort(),['group-media','profile-avatars']);
for(const bucket of audit.buckets)assert.equal(bucket.public,false,'Public storage bucket: '+bucket.id);
console.log(`PASS: hosted catalog — ${audit.functions.length} privileged RPC grants/search paths, ${audit.tables.length} RLS tables, profile column grants, private buckets and no browser upload-policy bypass. Metadata audit only; RPC authorization behavior requires the domain tests.`);
