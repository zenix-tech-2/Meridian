// Vercel serverless — AshtechPay proxy
// POST /api/collect
// ENV: ASHTECH_API_KEY
export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method === 'OPTIONS') return res.status(200).end();
  if(req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});

  const apiKey = process.env.ASHTECH_API_KEY;
  if(!apiKey) return res.status(500).json({error:'missing_ashtech_key', message:'ASHTECH_API_KEY not set in Vercel'});

  try{
    const r = await fetch('https://ashtechpay.top/v1/collect', {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+apiKey, 'Content-Type':'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  }catch(e){
    return res.status(502).json({error:'gateway_error', message: String(e?.message||e)});
  }
}
