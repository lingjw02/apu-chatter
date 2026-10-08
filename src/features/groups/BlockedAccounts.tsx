import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
type Account={user_id:string;display_name:string};
export function BlockedAccounts(){
 const [accounts,setAccounts]=useState<Account[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[confirm,setConfirm]=useState<Account|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{let live=true;void supabase!.rpc('blocked_accounts').then(({data,error})=>{if(!live)return;if(error)setError('Could not load blocked accounts. Close and reopen your profile to retry.');else setAccounts(data||[]);setLoading(false);});return()=>{live=false;};},[]);
 async function unblock(){
  if(!confirm||busy)return;setBusy(true);setError('');setNotice('');
  try{const r=await supabase!.rpc('set_member_block',{p_group_id:null,p_member_id:confirm.user_id,p_blocked:false});if(r.error)throw r.error;setAccounts(old=>old.filter(a=>a.user_id!==confirm.user_id));setNotice(`${confirm.display_name} is unblocked.`);setConfirm(null);}catch{setError('Could not unblock this account. Try again.');}finally{setBusy(false);}
 }
 return <section className="blocked-accounts" aria-label="Blocked accounts"><h3>Blocked accounts</h3><p>Your personal blocks apply across groups, including groups you have left.</p>
  {loading?<p role="status">Loading blocked accounts…</p>:!error&&!accounts.length?<p>No blocked accounts.</p>:accounts.map(account=><div className="blocked-account" key={account.user_id}><strong>{account.display_name}</strong><button type="button" disabled={busy} onClick={()=>{setConfirm(account);setNotice('');}}>Unblock {account.display_name}</button></div>)}
  {confirm&&<div className="blocked-confirm"><p>Unblock <strong>{confirm.display_name}</strong>? They can request a private chat when you share a group. Deleted conversations will not return.</p><button type="button" disabled={busy} onClick={()=>void unblock()}>Confirm unblock</button><button type="button" disabled={busy} onClick={()=>setConfirm(null)}>Keep blocked</button></div>}
  {error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
