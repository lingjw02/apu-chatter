import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Eye, EyeSlash, LockKey, EnvelopeSimple } from '@phosphor-icons/react';
import { safeReturnPath, supabase } from '../../lib/supabase';
import './auth.css';

export function AuthPage() {
 const mode = location.pathname;
 const register = mode === '/register', forgot = mode === '/forgot-password', reset = mode === '/reset-password', callback = mode === '/auth/callback';
 const next = safeReturnPath(new URLSearchParams(location.search).get('next'));
 const [email,setEmail] = useState(''); const [password,setPassword] = useState(''); const [name,setName] = useState('');
 const [visible,setVisible] = useState(false); const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [success,setSuccess] = useState('');
 useEffect(() => {
  if (!callback || !supabase) return;
  let active=true;
  supabase.auth.getUser().then(({data,error})=>{if(!active)return; if(error || !data.user?.email_confirmed_at) setError('This confirmation link is invalid or expired. Please sign in or request a new link.'); else location.replace(next); });
  return ()=>{active=false;};
 },[callback,next]);
 async function submit(e:React.FormEvent) {
  e.preventDefault(); setError(''); setSuccess('');
  if(!supabase) {setError('Account services are not connected yet. You can explore the design demo while setup is being prepared.'); return;}
  setBusy(true);
  try {
   if(register) {
    const result=await supabase.auth.signUp({email:email.trim(),password,options:{data:{display_name:name.trim()},emailRedirectTo:`${location.origin}/auth/callback?next=${encodeURIComponent(next)}`}});
    if(result.error) throw result.error;
    setSuccess('Check your email for a confirmation link. If you already have an account, sign in or reset your password.');
   } else if(forgot) {
    const result=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${location.origin}/reset-password`});
    if(result.error) throw result.error;
    setSuccess('If an account matches this email, you’ll receive a password reset link.');
   } else if(reset) {
    const {data}=await supabase.auth.getUser();
    if(!data.user) throw new Error('Open a valid password reset link from your email first.');
    const result=await supabase.auth.updateUser({password}); if(result.error) throw result.error;
    setSuccess('Password updated. You can return to your groups.'); setPassword('');
   } else {
    const result=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(result.error) throw new Error('Unable to sign in. Check your details and confirm your email, or reset your password.');
    if(!result.data.user.email_confirmed_at) throw new Error('Please confirm your email before joining a group.');
    location.assign(next);
   }
  } catch(err) {setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');} finally {setBusy(false);}
 }
 const suffix=`?next=${encodeURIComponent(next)}`;
 return <main className="auth-page"><section className="auth-story"><a href="/demo" className="auth-brand"><img src="/logo.svg" alt=""/>apu chatter.</a><div><span className="auth-orbit"><img src="/logo.svg" alt=""/></span><h1>Your people.<br/>Your little corner.</h1><p>For the big plans, the small moments,<br/>and everything you want to share.</p></div><span className="auth-caption">A private space for real conversations.</span></section><section className="auth-panel"><a className="auth-back" href="/demo"><ArrowLeft/> Explore the demo</a><div className="auth-form-wrap"><span className="auth-symbol">{forgot || reset ? <LockKey size={26}/> : <EnvelopeSimple size={26}/>}</span><h2>{callback?'A moment, we’re checking your link.':register?'Make yourself at home.':forgot?'Let’s get you back in.':reset?'A fresh start.':'Welcome back.'}</h2><p>{register?'Create your account, then find your people.':forgot?'Enter your email and we’ll send a reset link.':reset?'Choose a new password for your account.':callback?'Your email confirmation opens the door to your groups.':'Your conversations are waiting for you.'}</p>
 {!supabase && <div className="setup-note"><strong>Account setup in progress</strong><span>This is the real account interface. It needs a configured Supabase project before sign-up and sign-in work.</span></div>}
 {error && <div className="auth-error" role="alert">{error}</div>}
 {success ? <div className="auth-success" role="status"><CheckCircle size={26}/><p>{success}</p><a href={reset?next:`/login${suffix}`} className="primary-button">{reset?'Go to groups':'Back to sign in'}<ArrowRight/></a></div> : !callback && <form onSubmit={submit}>
 {register && <label>Display name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" maxLength={40} required placeholder="What should we call you?"/></label>}
 {!reset && <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com"/></label>}
 {!forgot && <label>Password<span className="password-field"><input type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={register||reset?'new-password':'current-password'} minLength={register||reset?12:1} required placeholder={register||reset?'At least 12 characters':'Your password'}/><button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(!visible)}>{visible?<EyeSlash/>:<Eye/>}</button></span></label>}
 {!register&&!forgot&&!reset && <a className="forgot-link" href={`/forgot-password${suffix}`}>Forgot your password?</a>}
 <button className="primary-button" disabled={busy}>{busy?'One moment…':register?'Create account':forgot?'Send reset link':reset?'Update password':'Sign in'}<ArrowRight/></button>
 </form>}
 <p className="auth-switch">{register?'Already part of the conversation?':'New around here?'} <a href={`${register?'/login':'/register'}${suffix}`}>{register?'Sign in':'Create an account'}</a></p>
 {callback && <a href={`/login${suffix}`}>Return to sign in</a>}
 </div><p className="auth-footer">No public feed. Just your people.</p></section></main>;
}
