import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AuthPage } from '../features/auth/AuthPage';
import { supabase, safeReturnPath } from '../lib/supabase';
import { ConnectedApp } from '../features/groups/ConnectedApp';

export function Root({demo}:{demo:React.ReactNode}) {
 const path=location.pathname;
 const isAuth=['/login','/register','/forgot-password','/reset-password','/auth/callback'].includes(path);
 const protectedPage=path==='/'||path.startsWith('/groups')||path.startsWith('/join/')||path==='/settings/profile';
 const [user,setUser]=useState<User|null>(null),[checking,setChecking]=useState(protectedPage),[error,setError]=useState('');
 useEffect(()=>{
  if(!protectedPage||!supabase){setChecking(false);return;}
  const client=supabase; let active=true;
  const refresh=async()=>{try{const {data,error}=await client.auth.getUser();if(!active)return;setUser(data.user?.email_confirmed_at?data.user:null);setError(error?'Your session could not be verified. Sign in again.':'');setChecking(false);}catch{if(active){setError('Unable to reach account services. Please try again.');setChecking(false);}}};
  void refresh();
  const {data}=client.auth.onAuthStateChange((_event,session)=>{if(active){setUser(session?.user.email_confirmed_at?session.user:null);setChecking(false);}});
  return()=>{active=false;data.subscription.unsubscribe();};
 },[protectedPage]);
 if(isAuth) return <AuthPage/>;
 if(protectedPage){
  if(checking)return <div className="connection-state"><img src="/logo.svg" alt=""/><h1>Opening your corner…</h1></div>;
  if(!supabase)return <div className="connection-state"><img src="/logo.svg" alt=""/><h1>Almost ready for your people.</h1><p>Connect a Supabase project to enable accounts and real group chats.</p><a href="/demo" className="primary-button">Explore the design demo</a><a href="/login">Preview sign in</a></div>;
  if(!user)return <div className="connection-state"><h1>Sign in to your corner.</h1><p>{error||'Please sign in with a verified email to continue.'}</p><a className="primary-button" href={`/login?next=${encodeURIComponent(safeReturnPath(path))}`}>Sign in</a><a href="/demo">Back to demo</a></div>;
  return <ConnectedApp user={user}/>;
 }
 return <>{demo}<a className="account-entry" href={supabase?'/groups':'/login'}>{supabase?'Open my account':'Preview accounts'} ↗</a></>;
}
