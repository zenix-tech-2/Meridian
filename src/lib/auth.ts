// Meridian Auth — email + 4-6 digit PIN, device-fingerprinted free-trial guard
import { supabase, isSupabaseConfigured } from './supabase';

const LS_KEY = 'meridian_session_v2';
const DEVICE_KEY = 'meridian_device_sig_v2';
const LOCAL_USAGE_KEY = 'meridian_local_uses_v2';
// ADMIN_EMAIL kept for build reference
const _ADMIN_EMAIL = 'honesttech237@gmail.com';
export const ADMIN_EMAIL = _ADMIN_EMAIL;

export type Session = { id:string; email:string; role:'user'|'admin' };

function deviceSig(): string {
  let d = localStorage.getItem(DEVICE_KEY);
  if (d) return d;
  const entropy = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    String(new Date().getTimezoneOffset()),
    Math.random().toString(36).slice(2)
  ].join('|');
  // simple hash
  let h=0; for(let i=0;i<entropy.length;i++) h = Math.imul(31,h)+entropy.charCodeAt(i)|0;
  d = 'm' + Math.abs(h).toString(36) + Date.now().toString(36);
  localStorage.setItem(DEVICE_KEY, d);
  return d;
}

export function getDeviceSig(){ return deviceSig(); }

async function sha256Hex(s:string){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

export function readSession(): Session | null {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch {return null;}
}
export function writeSession(s: Session | null){
  if(!s) localStorage.removeItem(LS_KEY); else localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export function localUses(): number {
  try { return parseInt(localStorage.getItem(LOCAL_USAGE_KEY)||'0',10) || 0; } catch {return 0;}
}
export function bumpLocalUses(){ localStorage.setItem(LOCAL_USAGE_KEY, String(localUses()+1)); }

/**
 * Sign up / Sign in — email + pin digits
 * Flow:
 *  - try sign in with email+pin
 *  - if not found, try create user (enforces device fingerprint against DB)
 *  - free trial: 3 forced uses before account creation is required, then 10 free credits
 */
export async function signInOrUp(email:string, pin:string): Promise<{ok:boolean; error?:string; session?:Session}> {
  if(!/^\S+@\S+\.\S+$/.test(email)) return {ok:false,error:'Invalid email'};
  if(!/^\d{4,8}$/.test(pin)) return {ok:false,error:'PIN must be 4–8 digits'};
  const pin_hash = await sha256Hex(pin+'|meridian|v2');
  const dsig = deviceSig();

  if(isSupabaseConfigured && supabase){
    // try sign in
    const { data: u } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if(u && u.pin_hash === pin_hash){
      writeSession({id:u.id,email:u.email,role:u.role});
      return {ok:true, session:{id:u.id,email:u.email,role:u.role}};
    }
    if(u && u.pin_hash !== pin_hash){
      return {ok:false,error:'Wrong PIN for this email'};
    }
    // check device reuse guard
    const { data: fp } = await supabase.from('used_fingerprints').select('*').eq('device_sig', dsig).maybeSingle();
    if(fp && fp.email !== email.toLowerCase()){
      return {ok:false,error:'This device already claimed free access. Use '+fp.email+' or buy a plan.'};
    }
    // create account
    const { data: created, error } = await supabase.from('users').insert({
      email: email.toLowerCase(),
      pin_hash,
      role: email.toLowerCase()===ADMIN_EMAIL ? 'admin':'user',
      free_uses_left: 10,
      device_sig: dsig,
    }).select().single();
    if(error) return {ok:false,error:error.message};
    // bind fingerprint
    await supabase.from('used_fingerprints').upsert({device_sig: dsig, email: email.toLowerCase()});
    writeSession({id:created.id,email:created.email,role:created.role});
    return {ok:true, session:{id:created.id,email:created.email,role:created.role}};
  }

  // offline fallback (dev mode)
  const sess:Session = { id:'local_'+btoa(email).replace(/[^a-z0-9]/gi,''), email: email.toLowerCase(), role: email.toLowerCase()===ADMIN_EMAIL?'admin':'user' };
  writeSession(sess);
  return {ok:true, session:sess};
}

export function signOut(){ writeSession(null); }

/** 
 * Usage gate:
 * - first 3 operations = forced signup
 * - after signup: 10 free credits
 * - after that: subscription required
 */
export async function assertCanUse(tool: string): Promise<{allowed:boolean; reason?:string; needSignup?:boolean; needPlan?:boolean}> {
  const s = readSession();
  if(!s){
    const u = localUses();
    if(u < 3) { bumpLocalUses(); return {allowed:true}; }
    return { allowed:false, needSignup:true, reason:'Create a free Meridian account to continue. First 10 uses are free.' };
  }
  if(isSupabaseConfigured && supabase){
    const { data: user } = await supabase.from('users').select('free_uses_left,usage_remaining,plan_expires_at,plan_id,role').eq('id', s.id).maybeSingle();
    if(!user) return {allowed:false, needSignup:true, reason:'Session expired — sign in again.'};
    if(user.role === 'admin') return {allowed:true};
    // check plan expiry
    if(user.plan_expires_at && new Date(user.plan_expires_at) < new Date()){
      await supabase.from('users').update({plan_id:null,plan_expires_at:null,usage_remaining:null}).eq('id', s.id);
      return {allowed:false, needPlan:true, reason:'Your plan expired.'};
    }
    if(user.usage_remaining !== null && user.usage_remaining > 0){
      await supabase.from('users').update({usage_remaining: user.usage_remaining-1}).eq('id', s.id);
      await supabase.from('tool_usage').insert({user_id:s.id,tool});
      return {allowed:true};
    }
    if(user.usage_remaining === null && user.plan_id){
      // unlimited time-based
      await supabase.from('tool_usage').insert({user_id:s.id,tool});
      return {allowed:true};
    }
    if(user.free_uses_left > 0){
      await supabase.from('users').update({free_uses_left: user.free_uses_left-1}).eq('id', s.id);
      await supabase.from('tool_usage').insert({user_id:s.id,tool});
      return {allowed:true};
    }
    return {allowed:false, needPlan:true, reason:'You used all free credits. Choose a plan to continue.'};
  }
  // fallback offline
  return {allowed:true};
}
