import {activityFetch} from '../features/feedback/NetworkActivity';
import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const backendConfigured = Boolean(url && key);
export const supabase = backendConfigured ? createClient(url!, key!, {
  global:{fetch:activityFetch},
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export function safeReturnPath(value: string | null): string {
  return value && /^\/join\/[a-f0-9]{64}$/.test(value) ? value : '/groups';
}
