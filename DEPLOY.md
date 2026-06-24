# Meridian Operations Suite — Deploy Guide

Fintech multi-tool PWA with AshtechPay subscriptions, Supabase backend, Cobalt media fetch.

---

## 1. Install prerequisites

Node 20+
```bash
npm install
```

Key packages already in repo:
- react 19
- vite 7 + vite-plugin-singlefile
- qrcode ^1.5.4
- @supabase/supabase-js ^2
- tailwindcss 4

---

## 2. Supabase setup (required for accounts, credits, tickets, admin)

1. Create a project at https://supabase.com
2. In SQL Editor, run `public/supabase.sql` (file is in this repo).
   It creates:
   - plans (trial 10, 30 uses 500 XAF, 100 uses 900 XAF, 500 uses 1900 XAF, unlimited_1m 2400 XAF)
   - users (email + pin_hash)
   - used_fingerprints (device anti-abuse)
   - transactions
   - tool_usage
   - tickets / ticket_messages
   - feature_requests
   - site_settings (support_email editable)

   It seeds admin: `honesttech237@gmail.com` / PIN `2370`

3. Get keys:
   - Project URL → `VITE_SUPABASE_URL`
   - anon key → `VITE_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (server only, for webhook)

---

## 3. AshtechPay setup

1. Get your API key at https://ashtechpay.top
2. Countries supported: BJ BF CM CF CG CI GA GN GQ GW ML NE CD SN TD TG
   - Operator names MUST match: "MTN Mobile Money", "Orange Money", etc.
3. Flows:
   - USSD Push: MTN, Moov, Airtel, Orange CM → 202 pending, webhook confirms
   - OTP SMS: Orange CI/SN/ML/GN… → 400 otp_required, ussd_code=null
   - OTP USSD: Orange BF → 400 otp_required with ussd_code “#144*4*6*amount#”
   - Wave: Wave CI/SN → 202 + wave_url

Server relay: `/api/collect.js` proxies to https://ashtechpay.top/v1/collect so the API key never hits the browser.

---

## 4. Environment variables – Vercel

In Vercel → Project → Settings → Environment Variables:

Frontend (Vite – must start with VITE_):
```
VITE_SUPABASE_URL = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGci...
VITE_COBALT_ENDPOINT = https://api.cobalt.tools
VITE_COBALT_API_KEY = (optional – only if your Cobalt instance requires it)
```

Server (Vercel Functions):
```
ASHTECH_API_KEY = your_ashtechpay_api_key_here
SUPABASE_URL = https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGci... (service_role, NOT anon)
```

Local dev: create `.env.local` with the VITE_ vars.

---

## 5. Webhook

AshtechPay sends POST to /api/ashtech-webhook

Production URL:
```
https://your-domain.vercel.app/api/ashtech-webhook
```

Set this as notify_url in payment calls (the app does this automatically).

The webhook:
- updates transactions.status
- activates user plan / credits
- idempotent on transaction_id

---

## 6. Usage / monetization flow

- First 3 uses: completely free, no signup (localStorage counter)
- 4th action → forced signup modal (email + 4-8 digit PIN)
- On signup → 10 free credits, device fingerprint stored in `used_fingerprints` to prevent re-trial
- After 10 credits → paywall modal opens automatically
- Plans (XAF):
  - 30 uses – 500 XAF
  - 100 uses – 900 XAF
  - 500 uses – 1900 XAF
  - Unlimited 30 days – 2400 XAF
- Admin (`honesttech237@gmail.com`) can add/edit/remove plans, change prices, enable/disable tools per plan.

Every tool run calls `assertCanUse()` which decrements credits server-side.

---

## 7. Admin console

Sign in as: `honesttech237@gmail.com` / PIN `2370`

Admin panel (top bar → Admin):
- Plans: edit name, price, credits, days, delete, add
- Users: view all, upgrade/downgrade, assign any plan, remove plan
- Tickets: read support / bug reports
- Settings: change support email, see all env key names

Support email (default: honesttech237@gmail.com) is editable in site_settings.

---

## 8. Support / ticketing

- Unauthenticated users can submit tickets & feature requests
- Authenticated users get a ticket history
- Admin sees all tickets in Admin → Tickets tab
- File upload field is present in ticket_messages table (attachment_url)

---

## 9. PWA / mobile

- manifest.webmanifest + /sw.js included
- Install APK button triggers beforeinstallprompt
- Bottom nav on mobile: Fetch · Transcode · Convert · QR · Ebook · More
- Android back button: history.pushState intercept closes drawer → auth → pay → support → admin before exiting
- Zero horizontal overflow – all grids use min-width:0, flex-wrap, word-break

---

## 10. Deploy to Vercel

```
npm i -g vercel
vercel --prod
```
Or connect the repo in Vercel dashboard.

Required files are already in repo:
- vercel.json (SPA rewrite)
- api/collect.js (AshtechPay proxy)
- api/ashtech-webhook.js (webhook handler)
- public/sw.js, public/manifest.webmanifest
- public/supabase.sql (run once in Supabase)

Build command: `npm run build`
Output directory: `dist`

---

## 11. Test checklist

1. Anonymous: use 3 times → auth modal appears
2. Sign up: email + 4-digit PIN → 10 credits granted
3. Burn 10 credits → paywall opens
4. Paywall: choose plan → enter CM phone (e.g. 670000000) + operator → AshtechPay collect
5. After webhook success → credits applied, tool unlocks
6. Admin login → honesttech237@gmail.com / 2370 → can edit plans, users, tickets
7. Support: send ticket as guest → appears in Admin → Tickets

---

Support contact: honesttech237@gmail.com
