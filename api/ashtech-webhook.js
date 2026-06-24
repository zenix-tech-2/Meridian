// Vercel serverless — AshtechPay webhook
// POST /api/ashtech-webhook
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';

function supa(){
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) return null;
  return createClient(url, key, { auth:{persistSession:false}});
}

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end();
  // Always 200 fast
  res.status(200).json({received:true});

  try{
    const { event, transaction_id, reference, amount, currency } = req.body || {};
    const s = supa();
    if(!s) return;

    // reference format: meridian_plan_{planId}_user_{userId}
    if(event === 'payment.completed'){
      await s.from('transactions').update({
        status:'success',
        amount_credited: amount,
        ashtech_transaction_id: transaction_id
      }).eq('ashtech_transaction_id', transaction_id);

      if(reference && reference.startsWith('meridian_plan_')){
        const m = reference.match(/meridian_plan_([0-9a-f-]+)_user_([0-9a-f-]+)/i);
        if(m){
          const planId = m[1]; const userId = m[2];
          const { data: plan } = await s.from('plans').select('*').eq('id', planId).single();
          if(plan){
            const upd:any = { plan_id: plan.id };
            if(plan.usage_credits !== null){
              upd.usage_remaining = (plan.usage_credits||0);
              upd.plan_expires_at = null;
            } else if(plan.duration_days){
              const exp = new Date(Date.now()+plan.duration_days*864e5).toISOString();
              upd.plan_expires_at = exp;
              upd.usage_remaining = null;
            }
            await s.from('users').update(upd).eq('id', userId);
          }
        }
      }
    }
    if(event === 'payment.failed'){
      await s.from('transactions').update({status:'failed'}).eq('ashtech_transaction_id', transaction_id);
    }
  }catch(e){ console.error(e); }
}
