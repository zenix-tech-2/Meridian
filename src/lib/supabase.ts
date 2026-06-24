// supabase client — safe to run build without env
import { createClient } from '@supabase/supabase-js';

const url = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export const isSupabaseConfigured = !!supabase;

// ---------- Types ----------
export type PlanRow = {
  id: string;
  code: string;
  name: string;
  price_xaf: number;
  usage_credits: number | null; // null = unlimited
  duration_days: number | null; // null = credits-only
  tools: string[] | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};
export type UserRow = {
  id: string;
  email: string;
  pin_hash: string;
  role: 'user'|'admin';
  plan_id: string | null;
  usage_remaining: number | null;
  plan_expires_at: string | null;
  free_uses_left: number;
  device_sig: string | null;
  created_at: string;
};
export type UsedFingerprintRow = { device_sig: string; email: string };
export type TransactionRow = {
  id: string; user_id: string; plan_id: string;
  ashtech_transaction_id: string | null;
  amount_gross: number; amount_credited: number | null;
  currency: string; status: 'pending'|'success'|'failed';
  phone: string | null; operator: string | null; country_code: string | null;
  created_at: string;
};
export type TicketRow = {
  id:string; user_id:string|null; email:string; subject:string; body:string;
  status:'open'|'pending_admin'|'closed';
  created_at:string;
};
export type TicketMessageRow = {
  id:string; ticket_id:string; sender:'user'|'admin'; body:string; attachment_url:string|null; created_at:string;
};
export type FeatureRequestRow = { id:string; email:string; title:string; body:string; status:string; created_at:string };
export type ToolUsageRow = { id:string; user_id:string; tool:string; created_at:string };
