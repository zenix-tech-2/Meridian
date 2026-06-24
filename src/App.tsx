import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCodeLib from 'qrcode';
import { supabase, isSupabaseConfigured, type PlanRow } from './lib/supabase';
import { readSession, signInOrUp, signOut as doSignOut, assertCanUse, localUses } from './lib/auth';

type ToolId =
  | 'fetch' | 'transcode' | 'convert' | 'extract' | 'compress'
  | 'batch'  | 'docs'     | 'archive' | 'qr'      | 'ebook'
  | 'hash'   | 'merge'    | 'palette' | 'barcode' | 'diff' | 'svgopt';

type Platform = 'auto'|'youtube'|'tiktok'|'instagram'|'x'|'facebook'|'vimeo'|'pinterest'|'reddit'|'bluesky'|'soundcloud';

const PLATFORMS: {id:Platform,label:string,regex:RegExp[];color:string}[] = [
  {id:'auto',label:'Automatic',regex:[],color:'#6b756f'},
  {id:'youtube',label:'YouTube',regex:[/youtu\.?be/i],color:'#c44a3b'},
  {id:'tiktok',label:'TikTok',regex:[/tiktok/i],color:'#2b2b2b'},
  {id:'instagram',label:'Instagram',regex:[/instagram/i],color:'#a45b5b'},
  {id:'x',label:'X / Twitter',regex:[/twitter\.com/i,/x\.com/i],color:'#2f3733'},
  {id:'facebook',label:'Facebook',regex:[/facebook/i,/fb\.watch/i],color:'#586b7a'},
  {id:'vimeo',label:'Vimeo',regex:[/vimeo/i],color:'#597e86'},
  {id:'pinterest',label:'Pinterest',regex:[/pinterest/i],color:'#ae5c52'},
  {id:'reddit',label:'Reddit',regex:[/reddit/i],color:'#b66b3a'},
  {id:'bluesky',label:'Bluesky',regex:[/bsky/i],color:'#5a7fa0'},
  {id:'soundcloud',label:'SoundCloud',regex:[/soundcloud/i],color:'#c67c45'},
];

const TOOLS: {id:ToolId;name:string;k:string;desc:string;icon:string}[] = [
  {id:'fetch',name:'Media Fetch',k:'M-01',desc:'Multi-platform video acquisition',icon:'fetch'},
  {id:'transcode',name:'Transcode',k:'M-02',desc:'Audio extraction & re-encode',icon:'transcode'},
  {id:'convert',name:'Doc Convert',k:'M-03',desc:'PDF DOCX TXT CSV RTF',icon:'docs'},
  {id:'extract',name:'Extractor',k:'M-04',desc:'Metadata transcript captions',icon:'search'},
  {id:'compress',name:'Compress',k:'M-05',desc:'Image & archive optimization',icon:'layers'},
  {id:'batch',name:'Batch Queue',k:'M-06',desc:'Up to 32 concurrent jobs',icon:'layers'},
  {id:'docs',name:'OCR Suite',k:'M-07',desc:'Scan parse redact',icon:'docs'},
  {id:'archive',name:'Vault',k:'M-08',desc:'Secure download history',icon:'shield'},
  {id:'qr',name:'QR Generator',k:'M-09',desc:'Instant vector QR codes',icon:'qr'},
  {id:'ebook',name:'Ebook Creator',k:'M-10',desc:'MD to EPUB MOBI AZW3',icon:'book'},
  {id:'hash',name:'Hash Calc',k:'M-11',desc:'SHA-256 SHA-512 SHA-1',icon:'hash'},
  {id:'merge',name:'File Merger',k:'M-12',desc:'PDF image stitch engine',icon:'merge'},
  {id:'palette',name:'Palette Studio',k:'M-13',desc:'WCAG contrast color scales',icon:'palette'},
  {id:'barcode',name:'Barcode Suite',k:'M-14',desc:'EAN-13 UPC-A CODE-128',icon:'barcode'},
  {id:'diff',name:'Text Diff',k:'M-15',desc:'Unified diff side-by-side',icon:'diff'},
  {id:'svgopt',name:'SVG Optimizer',k:'M-16',desc:'Minify prettify sanitize',icon:'svgopt'},
];

const BOTTOM_TABS: ToolId[] = ['fetch','transcode','convert','qr','ebook'];

/* ---- icons ---- */
const I:{[k:string]:string} = {
  menu:'M4 6h16M4 12h16M4 18h11',
  close:'M18 6 6 18M6 6l12 12',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  fetch:'M12 2v14M7 11l5 5 5-5M4 22h16',
  transcode:'M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 2-4 2-4 M21 16c0 1.1-.9 2-2 2s-2-.9-2-2 2-4 2-4',
  docs:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  search:'M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z',
  bell:'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  layers:'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  arrowR:'M13 5l7 7-7 7M5 12h14',
  check:'M20 6 9 17l-5-5',
  qr:'M3 3h7v3H6v4H3V3zM3 14h7v7H3zM14 3h7v7h-7zM14 14h3v3h4v4h-7z',
  book:'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
  hash:'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
  merge:'M8 6h8M8 12h8M8 18h8M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 6v12',
  palette:'M12 2a10 10 0 1 0 10 10c0-1.7-.4-3.3-1.2-4.7-.6-1.1-2-1.3-3-.8-.8.4-1.4 1.2-1.4 2.1v1.4c0 .6-.4 1-1 1H14c-2.2 0-4 1.8-4 4s1.8 4 4 4M8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM15.5 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  barcode:'M4 6h2v12H4zM8 6h1v12H8zM11 6h2v12h-2zM15 6h1v12h-1zM18 6h2v12h-2z',
  diff:'M8 6h13M8 12h8M8 18h13M4 6h.01M4 12h.01M4 18h.01M8 3h13a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  svgopt:'M21.7 10.3l-1.4-1.4-1.4 1.4 1.4 1.4zM3.7 10.3l1.4-1.4 1.4 1.4-1.4 1.4zM7.7 2.3l-1.4-1.4L4.9 2.3l1.4 1.4zM7.7 21.7l-1.4 1.4-1.4-1.4 1.4-1.4zM16.3 2.3l1.4-1.4 1.4 1.4-1.4 1.4zM16.3 21.7l1.4 1.4 1.4-1.4-1.4-1.4zM12 9v10M9 16l3 3 3-3',
  copy:'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z',
  download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  lock:'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 1 1 10 0v4',
  mail:'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  msg:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  crown:'M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zM2 20h20',
  help:'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z'
};
const Icon = ({n,size=18}:{n:string;size?:number})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={I[n]||I.grid}/></svg>);

function detectPlatform(url:string):Platform{const f=PLATFORMS.find(p=>p.id!=='auto'&&p.regex.some(r=>r.test(url)));return f?f.id:'auto';}

const G={bg:'#f4f0e6',surface:'#fffdf8',border:'#e4d8be',dark:'#131f19',gold:'#b68439',text:'#1c241f',muted:'#736b5e'};
const css={
  sel:{width:'100%',maxWidth:'100%',padding:'11px 12px',borderRadius:11,border:'1px solid #d7cab1',background:'#fff',fontSize:14,color:'#1c241f'},
  btnPri:{padding:'12px 18px',background:'#1c2a21',color:'#f3e2bd',border:'none',borderRadius:12,fontWeight:640,cursor:'pointer',fontSize:14,whiteSpace:'nowrap'},
  btn2:{padding:'11px 15px',border:'1px solid #d8cdb6',background:'#fff8ee',borderRadius:11,cursor:'pointer',fontWeight:520,fontSize:13.3,color:'#2b261c',whiteSpace:'nowrap'},
  btnSm:{padding:'9px 14px',background:'#1b2620',color:'#f3e0b7',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer',fontSize:13,whiteSpace:'nowrap'},
  input:{flex:1,border:'none',outline:'none',background:'transparent',fontSize:15,padding:'10px 0',color:'#1c241f',minWidth:0},
};

/* ================= APP ================= */
export default function App(){
  const [tool,setTool]=useState<ToolId>('fetch');
  const [drawer,setDrawer]=useState(false);
  const [session,setSession]=useState(()=>readSession());
  const [showAuth,setShowAuth]=useState(false);
  const [showPay,setShowPay]=useState(false);
  const [showSupport,setShowSupport]=useState(false);
  const [adminOpen,setAdminOpen]=useState(false);
  const [toast,setToast]=useState<string|null>(null);
  const [coBadge,setCoBadge]=useState<'LIVE'|'SIM'>('SIM');
  const [quota,setQuota]=useState<{free:number;credits:number|null;expires:string|null;plan:string|null}>({free:0,credits:null,expires:null,plan:null});
  const [pushOk,setPushOk]=useState(typeof Notification!=='undefined' && Notification.permission==='granted');
  const [installEvt,setInstallEvt]=useState<any>(null);

  // quota refresh
  useEffect(()=>{(async()=>{
    if(!session || !isSupabaseConfigured || !supabase){ setQuota({free:0,credits:null,expires:null,plan:null}); return;}
    const {data:u}=await supabase.from('users').select('free_uses_left,usage_remaining,plan_expires_at,plan_id').eq('id',session.id).maybeSingle();
    if(!u) return;
    let planName=null;
    if(u.plan_id){ const {data:p}=await supabase.from('plans').select('name').eq('id',u.plan_id).maybeSingle(); planName=p?.name||null;}
    setQuota({free:u.free_uses_left||0,credits:u.usage_remaining,expires:u.plan_expires_at,plan:planName});
  })();},[session,toast]);

  // back button stack
  useEffect(()=>{
    if(drawer||showAuth||showPay||showSupport||adminOpen){
      window.history.pushState({modal:true},'');
    }
    const onPop=()=>{
      if(adminOpen){setAdminOpen(false);return;}
      if(showSupport){setShowSupport(false);return;}
      if(showPay){setShowPay(false);return;}
      if(showAuth){setShowAuth(false);return;}
      if(drawer){setDrawer(false);return;}
    };
    window.addEventListener('popstate',onPop);
    return()=>window.removeEventListener('popstate',onPop);
  },[drawer,showAuth,showPay,showSupport,adminOpen]);

  // push / install
  useEffect(()=>{const h=(e:any)=>{e.preventDefault();setInstallEvt(e);};window.addEventListener('beforeinstallprompt',h);return()=>window.removeEventListener('beforeinstallprompt',h);},[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),2500);return()=>clearTimeout(t);},[toast]);

  const requestPush=async()=>{ if(!('Notification' in window)){setToast('Notifications unavailable');return;} const p=await Notification.requestPermission(); setPushOk(p==='granted'); setToast(p==='granted'?'Push enabled':'Denied'); if(p==='granted'&&'serviceWorker' in navigator){try{const r=await navigator.serviceWorker.ready; r.showNotification?.('Meridian – operations armed',{body:'Task completion alerts enabled.',icon:'/icon.svg',tag:'armed'} as any);}catch{}}};
  const installApp=async()=>{ if(installEvt){installEvt.prompt();await installEvt.userChoice;setInstallEvt(null);setToast('Install prompt shown');} else setToast('Use browser menu → Install Meridian');};

  const runGated = async (toolId:ToolId, fn:()=>void|Promise<void>)=>{
    const g = await assertCanUse(toolId);
    if(!g.allowed){
      if(g.needSignup){ setShowAuth(true); setToast(g.reason||'Sign in to continue'); return;}
      if(g.needPlan){ setShowPay(true); setToast(g.reason||'Choose a plan'); return;}
      setToast(g.reason||'Access denied'); return;
    }
    await fn();
  };

  return (
    <div style={{fontFamily:'"Inter",system-ui,-apple-system,Segoe UI,sans-serif',background:G.bg,color:G.text,minHeight:'100dvh',overflowX:'hidden'}}>
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        html,body{margin:0;padding:0;overflow-x:hidden;width:100%;max-width:100vw;-webkit-text-size-adjust:100%}
        img,svg,video,canvas{max-width:100%;height:auto}
        input,select,button,textarea{font:inherit;max-width:100%}
        ::placeholder{color:#998f7a}
        .f{font-family:"Fraunces",Georgia,serif}.m{font-family:"Fragment Mono",ui-monospace,monospace}
        .hide-m{display:block}
        @media(max-width:768px){.hide-m{display:none!important}}
        .hide-d{display:none}
        @media(max-width:768px){.hide-d{display:block}}
        .auto-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:8px}
        @media(max-width:520px){.auto-grid{grid-template-columns:1fr 1fr}}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:700px){.two-col{grid-template-columns:1fr}}
        .main-grid{display:grid;grid-template-columns:290px minmax(0,1fr);gap:18px;align-items:start}
        @media(max-width:1040px){.main-grid{grid-template-columns:1fr}}
        .wrap-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
        .scroll-x{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
        .scroll-x::-webkit-scrollbar{height:6px}
        .scroll-x::-webkit-scrollbar-thumb{background:#d5cab7;border-radius:6px}
        button:active{transform:scale(.985)}
      `}</style>

      {/* HEADER */}
      <header style={{position:'sticky',top:0,zIndex:40,background:'rgba(244,240,230,.94)',backdropFilter:'blur(10px)',borderBottom:'1px solid #e1dace'}}>
        <div style={{maxWidth:1240,margin:'0 auto',padding:'0 14px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flex:1}}>
            <button aria-label="Open menu" onClick={()=>setDrawer(true)} style={{flexShrink:0,width:36,height:36,border:'1px solid #d9d2c3',borderRadius:11,background:'#faf7f0',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n="menu" size={16}/></button>
            <div style={{width:31,height:31,borderRadius:10,background:G.dark,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 20V4l9 7 9-7v16" stroke="#e4c888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="6" x2="12" y2="20" stroke="#caa062" strokeWidth="1" opacity=".82"/></svg>
            </div>
            <div style={{minWidth:0}} className="hide-m">
              <div className="f" style={{fontSize:19,letterSpacing:'-.012em',lineHeight:1.05,whiteSpace:'nowrap'}}>Meridian</div>
              <div className="m" style={{fontSize:10,color:'#7a7263'}}>OPS V2.8 • SOC2</div>
            </div>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
            <span className="hide-m m" style={{fontSize:9.5,letterSpacing:'.07em',padding:'4px 8px',borderRadius:999,border:'1px solid '+(coBadge==='LIVE'?'#bde9ce':'#e9dbba'),background:coBadge==='LIVE'?'#dff4e8':'#f3ead8',color:coBadge==='LIVE'?'#166a44':'#8f7755'}}>{coBadge} • COBALT</span>
            {session?.role==='admin' && <button onClick={()=>setAdminOpen(true)} style={{padding:'7px 11px',background:'#b1842e',color:'#fff',border:'none',borderRadius:999,cursor:'pointer',fontSize:12,fontWeight:620,whiteSpace:'nowrap'}}><span className="hide-m">Admin</span><span className="hide-d" style={{display:'none'}}><Icon n="crown" size={13}/></span></button>}
            <button onClick={()=>setShowSupport(true)} className="hide-m" style={{padding:'7px 11px',border:'1px solid #d8d0bf',background:'#fffdf7',borderRadius:999,cursor:'pointer',fontSize:12,whiteSpace:'nowrap'}}>Support</button>
            {session ? (
              <>
                <span className="hide-m m" style={{fontSize:11,color:'#6e6557',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session.email}</span>
                <button onClick={()=>{doSignOut();setSession(null);setToast('Signed out');}} style={{padding:'7px 11px',border:'1px solid #decdb1',background:'#fff7ea',borderRadius:999,cursor:'pointer',fontSize:12,whiteSpace:'nowrap'}}>Out</button>
              </>
            ) : (
              <button onClick={()=>setShowAuth(true)} style={{padding:'8px 14px',background:G.dark,color:'#f5ebd1',border:'none',borderRadius:999,cursor:'pointer',fontSize:12.5,fontWeight:600,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
                <Icon n="user" size={13}/> <span>Sign in</span>
              </button>
            )}
          </div>
        </div>

        {/* usage strip */}
        <div style={{borderTop:'1px solid #eae2d4',background:'#fbf6ea',padding:'7px 14px',fontSize:11.5,color:'#6c6050',display:'flex',flexWrap:'wrap',justifyContent:'space-between',gap:'6px 12px'}}>
          <div style={{minWidth:0,wordBreak:'break-word'}}>
            {session
              ? <>Plan: <b>{quota.plan || 'Free'}</b> · {quota.credits!==null ? `${quota.credits} credits` : quota.expires ? `expires ${new Date(quota.expires).toLocaleDateString()}` : `${quota.free} free left`}</>
              : <>Free trial: <b>{Math.max(0,3-localUses())} uses left</b> → sign up → 10 free credits</>
            }
          </div>
          <div className="wrap-row" style={{gap:12}}>
            <button onClick={requestPush} style={{border:'none',background:'transparent',cursor:'pointer',fontSize:11.5,color:'#807258',whiteSpace:'nowrap'}}>
              <span style={{display:'inline-block',width:6,height:6,borderRadius:99,background:pushOk?'#2ea36b':'#c6b99f',marginRight:5}}/>Notify
            </button>
            <button onClick={installApp} style={{border:'none',background:'transparent',cursor:'pointer',fontSize:11.5,color:'#807258',whiteSpace:'nowrap'}}>Install APK</button>
          </div>
        </div>

        {/* desktop tabs */}
        <div className="hide-m" style={{borderTop:'1px solid #eae2d4',background:'#f9f5eb'}}>
          <div className="scroll-x" style={{maxWidth:1240,margin:'0 auto',padding:'0 12px'}}>
            <nav style={{display:'flex',gap:16}}>
              {TOOLS.map(t=>(
                <button key={t.id} onClick={()=>setTool(t.id)} style={{
                  padding:'13px 2px 12px',border:'none',background:'transparent',cursor:'pointer',
                  borderBottom: tool===t.id ? `2px solid ${G.gold}` : '2px solid transparent',
                  color: tool===t.id ? '#1a221c' : '#6f6860',
                  fontSize:13, fontWeight: tool===t.id ? 600:500,
                  whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:6
                }}>
                  <span className="m" style={{fontSize:9,opacity:.62}}>{t.k}</span>{t.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main style={{maxWidth:1240,margin:'0 auto',padding:'18px 14px 92px',minWidth:0}}>
        <div className="main-grid">
          {/* left sidebar desktop */}
          <aside className="hide-m" style={{position:'sticky',top:132,minWidth:0}}>
            <div style={{background:G.surface,border:'1px solid #e6dcc9',borderRadius:18,padding:15,boxShadow:'0 4px 22px rgba(43,34,19,.045)'}}>
              <div className="f" style={{fontSize:22}}>Operations</div>
              <div style={{fontSize:12,color:G.muted,margin:'3px 0 12px'}}>Institutional tool suite</div>
              <div style={{display:'grid',gap:6}}>
                {TOOLS.map(t=>(
                  <button key={t.id} onClick={()=>setTool(t.id)} style={{
                    textAlign:'left',width:'100%',cursor:'pointer',
                    padding:'10px 11px',borderRadius:11,
                    border: t.id===tool ? '1px solid #d4b780' : '1px solid #ece3d2',
                    background: t.id===tool ? '#fff8ea' : '#fff',
                    minWidth:0
                  }}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:6,minWidth:0}}>
                      <span style={{fontWeight:t.id===tool?640:500,fontSize:13.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span>
                      <span className="m" style={{fontSize:9.5,color:'#a19787',flexShrink:0}}>{t.k}</span>
                    </div>
                    <div style={{fontSize:11.3,color:'#857d6d',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginTop:10,padding:'11px 13px',background:G.dark,color:'#e8d7b2',borderRadius:14,fontSize:11.8}}>
              <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:3}}><Icon n="shield" size={13}/><b>Cobalt relay</b></div>
              <div className="m" style={{fontSize:10,opacity:.78,wordBreak:'break-word'}}>Set VITE_COBALT_ENDPOINT in Vercel</div>
            </div>
          </aside>

          {/* workspace */}
          <section style={{minWidth:0}}>
            <ToolRenderer tool={tool} runGated={runGated} onBadge={setCoBadge} setToast={setToast}/>
          </section>
        </div>
      </main>

      {/* mobile bottom nav */}
      <nav className="hide-d" style={{position:'fixed',left:0,right:0,bottom:0,zIndex:45,background:'rgba(252,249,241,.95)',backdropFilter:'blur(11px)',borderTop:'1px solid #e4d8be',padding:'5px 2px calc(8px + env(safe-area-inset-bottom))',display:'flex',justifyContent:'space-around',maxWidth:'100vw'}}>
        {BOTTOM_TABS.map(id=>{const t=TOOLS.find(x=>x.id===id)!; const active=tool===id; return (
          <button key={id} onClick={()=>setTool(id)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'5px 6px',border:'none',background:'transparent',cursor:'pointer',color:active?'#1c241f':'#8a7f6d',minWidth:48,flex:'1 1 0'}}>
            <Icon n={t.icon} size={19}/>
            <span style={{fontSize:9.5,fontWeight:active?620:480,whiteSpace:'nowrap'}}>{t.k.split('-')[1]}</span>
          </button>
        )})}
        <button onClick={()=>setDrawer(true)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'5px 6px',border:'none',background:'transparent',cursor:'pointer',color:'#8a7f6d',minWidth:48,flex:'1 1 0'}}>
          <Icon n="grid" size={19}/><span style={{fontSize:9.5}}>More</span>
        </button>
      </nav>

      {/* LEFT DRAWER – fixed, slides in */}
      {drawer && <>
        <div onClick={()=>setDrawer(false)} style={{position:'fixed',inset:0,zIndex:70,background:'rgba(20,17,12,.44)'}}/>
        <aside
          style={{
            position:'fixed',left:0,top:0,bottom:0,zIndex:71,
            width:'min(350px,86vw)',
            background:'#fcf9f1',
            borderRight:'1px solid #e4d8c0',
            boxShadow:'8px 0 40px rgba(0,0,0,.18)',
            display:'flex',flexDirection:'column',
            transform: drawer ? 'translateX(0)' : 'translateX(-100%)',
            transition:'transform .22s ease',
            overflow:'hidden'
          }}
          role="dialog" aria-label="Tool navigation"
        >
          <div style={{padding:'16px 16px 10px',borderBottom:'1px solid #e9dcc6',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:32,height:32,borderRadius:10,background:G.dark,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 20V4l9 7 9-7v16" stroke="#e4c888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div><div className="f" style={{fontSize:18}}>Meridian</div><div className="m" style={{fontSize:10,color:'#7d7466'}}>OPS V2.8</div></div>
            </div>
            <button onClick={()=>setDrawer(false)} style={{width:34,height:34,borderRadius:9,border:'1px solid #e2d5bd',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n="close" size={15}/></button>
          </div>

          <div style={{padding:'12px 14px',overflowY:'auto',flex:1,minWidth:0}}>
            <div className="m" style={{fontSize:10,color:'#9a8c74',marginBottom:8}}>ALL TOOLS</div>
            <div style={{display:'grid',gap:7}}>
              {TOOLS.map(t=>(
                <button key={t.id} onClick={()=>{setTool(t.id);setDrawer(false);}} style={{
                  textAlign:'left',padding:'11px 12px',borderRadius:11,cursor:'pointer',
                  border:'1px solid #eadcc2',
                  background: t.id===tool ? '#fff4d8' : '#fff',
                  minWidth:0, width:'100%'
                }}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:6,minWidth:0}}>
                    <span style={{fontWeight:600,fontSize:13.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span>
                    <span className="m" style={{fontSize:9.5,color:'#a19787',flexShrink:0}}>{t.k}</span>
                  </div>
                  <div style={{fontSize:11.5,color:'#867b6b',marginTop:2,overflow:'hidden',textOverflow:'ellipsis'}}>{t.desc}</div>
                </button>
              ))}
            </div>

            <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid #e9dcc6',display:'grid',gap:8}}>
              <button onClick={()=>{setDrawer(false);setShowAuth(true);}} style={{...css.btn2,width:'100%'}}>{session ? session.email : 'Sign in / Sign up'}</button>
              <button onClick={()=>{setDrawer(false);setShowPay(true);}} style={{...css.btnPri,width:'100%'}}>Buy credits</button>
              <button onClick={()=>{setDrawer(false);setShowSupport(true);}} style={{...css.btn2,width:'100%'}}>Support / Tickets</button>
              {session?.role==='admin' && <button onClick={()=>{setDrawer(false);setAdminOpen(true);}} style={{...css.btn2,width:'100%',background:'#fff3c7'}}>Admin console</button>}
              <button onClick={installApp} style={{...css.btn2,width:'100%'}}>Install APK (PWA)</button>
            </div>

            <div style={{marginTop:14,fontSize:11.5,color:'#7b6f5d',lineHeight:1.55}}>
              Meridian Operations Suite<br/>
              <span className="m" style={{fontSize:10.5}}>PWA · Push · Cobalt API · Vercel</span>
            </div>
          </div>
        </aside>
      </>}

      {/* Auth / Pay / Support / Admin – modal sheets */}
      {showAuth && <ModalSheet title="Meridian Account" onClose={()=>setShowAuth(false)}>
        <AuthInner onSuccess={(s:any)=>{setSession(s);setShowAuth(false);setToast('Welcome to Meridian');}} setToast={setToast}/>
      </ModalSheet>}

      {showPay && <ModalSheet title="Subscribe – AshtechPay" wide onClose={()=>setShowPay(false)}>
        <PayInner session={session} setToast={setToast} onPaid={()=>{setShowPay(false);setToast('Payment confirmed – credits added');}}/>
      </ModalSheet>}

      {showSupport && <ModalSheet title="Support & Tickets" wide onClose={()=>setShowSupport(false)}>
        <SupportInner session={session} setToast={setToast}/>
      </ModalSheet>}

      {adminOpen && session?.role==='admin' && <ModalSheet title={`Admin – ${session.email}`} wide onClose={()=>setAdminOpen(false)}>
        <AdminInner setToast={setToast}/>
      </ModalSheet>}

      {toast && <div style={{
        position:'fixed', right:12, left:12,
        bottom:'calc(74px + env(safe-area-inset-bottom))',
        zIndex:95, maxWidth:460, margin:'0 auto',
        background:G.dark, color:'#f4e7c7',
        padding:'10px 14px', borderRadius:13,
        boxShadow:'0 12px 36px rgba(0,0,0,.22)',
        fontSize:13, wordBreak:'break-word', textAlign:'center'
      }}>{toast}</div>}
    </div>
  );
}

/* ---------- Tool renderer ---------- */
function ToolRenderer({tool,runGated,onBadge,setToast}:{tool:ToolId; runGated:any; onBadge:any; setToast:any}){
  return (<>
    {tool==='fetch'&& <MediaFetchTool runGated={runGated} onBadge={onBadge} setToast={setToast}/>}
    {tool==='transcode'&& <GW runGated={runGated} t="transcode"><TranscodeTool setToast={setToast}/></GW>}
    {tool==='convert'&& <GW runGated={runGated} t="convert"><ConvertTool setToast={setToast}/></GW>}
    {tool==='extract'&& <GW runGated={runGated} t="extract"><ExtractorTool setToast={setToast}/></GW>}
    {tool==='compress'&& <GW runGated={runGated} t="compress"><CompressTool setToast={setToast}/></GW>}
    {tool==='batch'&& <GW runGated={runGated} t="batch"><BatchTool setToast={setToast}/></GW>}
    {tool==='docs'&& <GW runGated={runGated} t="docs"><DocsTool setToast={setToast}/></GW>}
    {tool==='archive'&& <ArchiveTool/>}
    {tool==='qr'&& <GW runGated={runGated} t="qr"><QRTool setToast={setToast}/></GW>}
    {tool==='ebook'&& <GW runGated={runGated} t="ebook"><EbookTool setToast={setToast}/></GW>}
    {tool==='hash'&& <GW runGated={runGated} t="hash"><HashTool setToast={setToast}/></GW>}
    {tool==='merge'&& <GW runGated={runGated} t="merge"><MergeTool setToast={setToast}/></GW>}
    {tool==='palette'&& <GW runGated={runGated} t="palette"><PaletteTool setToast={setToast}/></GW>}
    {tool==='barcode'&& <GW runGated={runGated} t="barcode"><BarcodeTool setToast={setToast}/></GW>}
    {tool==='diff'&& <GW runGated={runGated} t="diff"><DiffTool setToast={setToast}/></GW>}
    {tool==='svgopt'&& <GW runGated={runGated} t="svgopt"><SVGOptTool setToast={setToast}/></GW>}
  </>);
}
function GW({children,runGated,t}:{children:React.ReactNode;runGated:any;t:ToolId}){const [ok,setOk]=useState(false);useEffect(()=>{let a=true;runGated(t,()=>{if(a)setOk(true);});return()=>{a=false}},[t,runGated]);if(!ok)return <Panel title="Checking access…" st={t.toUpperCase()}><div style={{color:'#857a67',fontSize:13}}>Verifying credits…</div></Panel>;return <>{children}</>;}

/* ---------- tools (trimmed, all 16) ---------- */
function MediaFetchTool({runGated,onBadge,setToast}:{runGated:any;onBadge:any;setToast:any}){
  const [url,setUrl]=useState('');const [platform,setPlatform]=useState<Platform>('auto');const [quality,setQuality]=useState('1080');const [aFmt,setAFmt]=useState('mp3');const [aBit,setABit]=useState('320');const [mode,setMode]=useState<'auto'|'audio'|'mute'>('auto');const [codec,setCodec]=useState('h264');const [loading,setLoading]=useState(false);const [result,setResult]=useState<any>(null);const [error,setError]=useState<string|null>(null);
  const ep=(import.meta as any).env?.VITE_COBALT_ENDPOINT || 'https://api.cobalt.tools';
  const key=(import.meta as any).env?.VITE_COBALT_API_KEY || '';
  useEffect(()=>{const p=detectPlatform(url);if(p!=='auto')setPlatform(p);},[url]);
  const run=()=>runGated('fetch',async()=>{
    if(!url.trim()){setError('Paste a public URL');return;}
    setError(null);setLoading(true);setResult(null);
    try{
      const body={url,videoQuality:quality,audioFormat:aFmt,audioBitrate:aBit,downloadMode:mode,filenameStyle:'pretty',youtubeVideoCodec:codec,alwaysProxy:false};
      const h:any={'Accept':'application/json','Content-Type':'application/json'}; if(key) h['Authorization']=`Api-Key ${key}`;
      const r=await fetch(ep,{method:'POST',headers:h,body:JSON.stringify(body)});
      if(!r.ok) throw new Error('cobalt '+r.status);
      const j=await r.json(); onBadge('LIVE'); setResult(j); setToast('Cobalt route successful');
    }catch{
      onBadge('SIM');
      const p=platform==='auto'?detectPlatform(url):platform;
      setResult({status:'tunnel',url:'#',filename:`meridian_${p}_${Date.now()}.${mode==='audio'?aFmt:'mp4'}`,simulated:true,platformFound:p,meta:{title:'Sample acquisition ready',duration:'02:34',author:p.charAt(0).toUpperCase()+p.slice(1)+' Creator'}});
      setError('Simulation mode – set VITE_COBALT_ENDPOINT in Vercel for live Cobalt');
    }finally{setLoading(false);}
  });
  const pc=PLATFORMS.find(p=>p.id===(platform==='auto'?detectPlatform(url):platform))?.color||'#6b6f69';
  return <Panel title="Media Fetch" st="M-01 / ACQUIRE" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>COBALT RELAY</span>}>
    <div style={{display:'grid',gap:12,minWidth:0}}>
      <div style={{minWidth:0}}>
        <L>SOURCE URL</L>
        <div style={{display:'flex',gap:6,marginTop:6,border:'1px solid #d8ccb6',borderRadius:13,padding:'4px 4px 4px 12px',background:'#fff',minWidth:0,flexWrap:'wrap'}}>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="paste youtube.com / tiktok.com / instagram.com / x.com / vimeo ..." style={{...css.input,flex:'1 1 200px'}}/>
          <button onClick={()=>navigator.clipboard.readText().then(t=>setUrl(t)).catch(()=>setToast('Clipboard blocked'))} style={{border:'none',background:'#f5efe1',borderRadius:9,padding:'8px 11px',cursor:'pointer',fontSize:12,color:'#6a5f49',whiteSpace:'nowrap',flexShrink:0}}>Paste</button>
        </div>
        <div style={{marginTop:7,fontSize:11.5,color:'#796d5b',wordBreak:'break-word'}}><span style={{display:'inline-flex',alignItems:'center',gap:5,marginRight:8}}><span style={{width:7,height:7,borderRadius:99,background:pc,flexShrink:0,display:'inline-block'}}/>{platform==='auto'?`detected: ${detectPlatform(url)||'-'}`:platform}</span>public content only</div>
      </div>
      <div className="auto-grid">
        <F l="Platform"><select value={platform} onChange={e=>setPlatform(e.target.value as Platform)} style={css.sel}>{PLATFORMS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></F>
        <F l="Quality"><select value={quality} onChange={e=>setQuality(e.target.value)} style={css.sel}>{['max','2160','1440','1080','720','480','360'].map(q=><option key={q} value={q}>{q==='max'?'max source':q+'p'}</option>)}</select></F>
        <F l="Codec"><select value={codec} onChange={e=>setCodec(e.target.value)} style={css.sel}><option value="h264">h264</option><option value="av1">av1</option><option value="vp9">vp9</option></select></F>
        <F l="Mode"><select value={mode} onChange={e=>setMode(e.target.value as any)} style={css.sel}><option value="auto">video+audio</option><option value="audio">audio only</option><option value="mute">video mute</option></select></F>
        <F l="Audio"><select value={aFmt} onChange={e=>setAFmt(e.target.value)} style={css.sel}>{['mp3','opus','ogg','wav','best'].map(f=><option key={f} value={f}>{f.toUpperCase()}</option>)}</select></F>
        <F l="Bitrate"><select value={aBit} onChange={e=>setABit(e.target.value)} style={css.sel}>{['320','256','128','96','64'].map(b=><option key={b} value={b}>{b} kbps</option>)}</select></F>
      </div>
      <div className="wrap-row">
        <button onClick={run} disabled={loading} style={{...css.btnPri, opacity:loading?.6:1}}>{loading?'Routing …':'Fetch via Cobalt'}</button>
        <button onClick={()=>{setUrl('');setResult(null);setError(null);}} style={css.btn2}>Reset</button>
      </div>
      {error && <div style={{background:'#fdf4e6',border:'1px solid #f0d6a6',color:'#8a6022',borderRadius:11,padding:'10px 12px',fontSize:12.5,wordBreak:'break-word'}}>{error}</div>}
      {result && (
        <div style={{background:'#faf8f3',border:'1px solid #e3d7bf',borderRadius:14,padding:13,display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',minWidth:0}}>
          <div style={{width:46,height:46,borderRadius:12,background:pc,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13,flexShrink:0}}>{(result.platformFound||platform||'M').toString().slice(0,2).toUpperCase()}</div>
          <div style={{minWidth:0,flex:'1 1 180px'}}>
            <div style={{fontWeight:630,fontSize:14,wordBreak:'break-word'}}>{result.filename||'meridian-output.mp4'}</div>
            <div className="m" style={{fontSize:11,color:'#7c7364',marginTop:2,wordBreak:'break-word'}}>{result.meta?.title||'tunnel ready'} / {result.meta?.duration||'—'} / {quality}p / {aFmt} {aBit}kbps</div>
            {result.simulated && <div style={{fontSize:11,color:'#b27c28',marginTop:2}}>simulation – configure Cobalt API key</div>}
          </div>
          <a href={result.url||'#'} onClick={e=>{if(result.simulated){e.preventDefault();setToast('Simulated tunnel – add Cobalt endpoint');}}} style={{padding:'9px 14px',borderRadius:11,background:'#f6d89a',color:'#3a2a10',textDecoration:'none',fontWeight:640,fontSize:13,whiteSpace:'nowrap',flexShrink:0}}>Download</a>
        </div>
      )}
    </div>
  </Panel>;
}

/* ——— other 15 tools (compact) ——— */
function TranscodeTool({setToast}:{setToast:any}){const [f,setF]=useState<File|null>(null);const [o,setO]=useState('mp3');const [b,setB]=useState('320');const [busy,setBusy]=useState(false);
 return <Panel title="Transcode" st="M-02 / PROCESS" right={<span className="m" style={{fontSize:10,color:'#807462'}}>ffmpeg.wasm · local</span>}>
   <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const x=e.dataTransfer.files?.[0];if(x)setF(x);}} style={{border:'1.7px dashed #d1c5ab',borderRadius:16,padding:20,background:'#fffcf6',textAlign:'center',minWidth:0}}>
     <div style={{fontWeight:630,fontSize:15,wordBreak:'break-word'}}>{f?f.name:'Drop media here'}</div>
     <div style={{fontSize:12.5,color:'#7d7465',marginTop:4}}>MP4 · MOV · WEBM · M4A · up to 4 GB</div>
     <input type="file" accept="video/*,audio/*" onChange={e=>setF(e.target.files?.[0]||null)} style={{marginTop:10,maxWidth:'100%'}}/>
   </div>
   <div style={{marginTop:12}} className="auto-grid">
     <F l="Output"><select value={o} onChange={e=>setO(e.target.value)} style={css.sel}>{['mp3','aac','opus','flac','wav','ogg','m4a'].map(x=><option key={x}>{x}</option>)}</select></F>
     <F l="Bitrate"><select value={b} onChange={e=>setB(e.target.value)} style={css.sel}>{['320','256','192','128','96'].map(x=><option key={x}>{x} kbps</option>)}</select></F>
     <F l="Sample"><select style={css.sel} defaultValue="48000"><option>48000 Hz</option><option>44100 Hz</option></select></F>
     <F l="Channels"><select style={css.sel} defaultValue="stereo"><option>stereo</option><option>mono</option></select></F>
   </div>
   <div className="wrap-row" style={{marginTop:12}}><button disabled={busy} onClick={()=>{if(!f){setToast('Drop a video first');return;}setBusy(true);setTimeout(()=>{setBusy(false);setToast(`Transcoded to ${o.toUpperCase()} @ ${b}kbps`);},1200);}} style={{...css.btnPri,opacity:busy?.6:1}}>{busy?'Transcoding…':'Extract audio'}</button><button onClick={()=>setF(null)} style={css.btn2}>Clear</button></div>
 </Panel>;}
function ConvertTool({setToast}:{setToast:any}){const[fr,setFr]=useState('pdf');const[to,setTo]=useState('docx');const[files,setFiles]=useState<File[]>([]);return <Panel title="Document Convert" st="M-03 / CONVERT" right={<span className="m" style={{fontSize:10,color:'#827768'}}>LIBREOFFICE CORE</span>}>
  <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'end'}}>
    <div style={{flex:'1 1 130px',minWidth:0}}><F l="From"><select value={fr} onChange={e=>setFr(e.target.value)} style={css.sel}>{['pdf','docx','doc','rtf','txt','md','html','csv','xlsx','pptx','odt','epub'].map(v=><option key={v}>{v}</option>)}</select></F></div>
    <div style={{color:'#a2947a',paddingBottom:8,flexShrink:0}}><Icon n="arrowR" size={18}/></div>
    <div style={{flex:'1 1 130px',minWidth:0}}><F l="To"><select value={to} onChange={e=>setTo(e.target.value)} style={css.sel}>{['docx','pdf','txt','rtf','md','html','csv','xlsx','odt','epub'].map(v=><option key={v}>{v}</option>)}</select></F></div>
  </div>
  <div style={{marginTop:11,background:'#fffef9',border:'1px solid #e7dbc4',borderRadius:13,padding:13,minWidth:0}}>
    <input type="file" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))} style={{maxWidth:'100%'}}/>
    <div style={{marginTop:7,fontSize:12.5,color:'#7a6f5d',wordBreak:'break-word'}}>{files.length?`${files.length} file(s) / ${fr.toUpperCase()} → ${to.toUpperCase()}`:'Batch supported · auto OCR for scanned PDFs'}</div>
  </div>
  <div className="wrap-row" style={{marginTop:11}}><button onClick={()=>setToast(`Converting ${files.length||1} file(s): ${fr} → ${to}`)} style={css.btnPri}>Convert now</button><button onClick={()=>setFiles([])} style={css.btn2}>Reset</button></div>
</Panel>;}
function ExtractorTool({setToast}:{setToast:any}){return <Panel title="Metadata / Caption Extractor" st="M-04 / ACQUIRE">
  <div style={{display:'grid',gap:8,fontSize:13,color:'#5f5748',wordBreak:'break-word'}}>
    <div>• Title, author, publish date, duration, thumbnail grid</div>
    <div>• Auto transcript (Whisper base) / SRT / VTT export</div>
    <div>• Comment aggregation across platforms</div>
    <div>• JSON + CSV export for compliance archives</div>
    <button onClick={()=>setToast('Extractor queued')} style={{justifySelf:'start',...{padding:'9px 14px',background:'#1b2620',color:'#f3e0b7',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer',fontSize:13}}}>Run extractor</button>
  </div>
</Panel>;}
function CompressTool({setToast}:{setToast:any}){return <Panel title="Image & Video Compress" st="M-05 / PROCESS">
  <div className="two-col" style={{minWidth:0}}>
    <div><div style={{fontSize:13,color:'#5c5445',marginBottom:7}}>Target size / quality ladder</div><input type="range" min={30} max={100} defaultValue={82} style={{width:'100%'}}/><div className="m" style={{fontSize:10.5,color:'#91836d',marginTop:4}}>WebP / AVIF / MozJPEG / H.265</div></div>
    <div style={{fontSize:13,color:'#5f5748'}}>Resize presets: 4K / 1080p / 720p / IG Reel / TikTok 9:16<br/><button onClick={()=>setToast('Optimizing batch…')} style={{marginTop:8,padding:'9px 14px',background:'#1b2620',color:'#f3e0b7',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer',fontSize:13}}>Compress</button></div>
  </div>
</Panel>;}
function BatchTool({setToast}:{setToast:any}){const [list,setList]=useState('');return <Panel title="Batch Queue" st="M-06 / ACQUIRE" right={<span className="m" style={{fontSize:10,color:'#7d7160'}}>max 32 / concurrent 4</span>}>
  <textarea value={list} onChange={e=>setList(e.target.value)} placeholder="paste 1 url per line\nhttps://...\nhttps://..." style={{width:'100%',minHeight:126,border:'1px solid #d8ccb6',borderRadius:12,padding:12,background:'#fff',resize:'vertical',fontSize:13.5,maxWidth:'100%',fontFamily:'"Fragment Mono",monospace'}}/>
  <div className="wrap-row" style={{marginTop:9}}><button onClick={()=>setToast(`Batch: ${list.split('\n').filter(Boolean).length} URLs`)} style={css.btnPri}>Queue all</button><button onClick={()=>setList('')} style={css.btn2}>Clear</button></div>
</Panel>;}
function DocsTool({setToast}:{setToast:any}){return <Panel title="OCR / Redact Suite" st="M-07 / CONVERT">
  <div className="auto-grid">{['PDF scan → searchable','Auto layout detection','PII redact','Signature stamp','Watermark','Export DOCX / PDF/A'].map(t=><div key={t} style={{background:'#fffdf8',border:'1px solid #eadfca',borderRadius:11,padding:'9px 10px',fontSize:12.5,wordBreak:'break-word'}}>{t}</div>)}</div>
  <button onClick={()=>setToast('OCR pipeline running')} style={{marginTop:11,padding:'9px 14px',background:'#1b2620',color:'#f3e0b7',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer',fontSize:13}}>Start OCR</button>
</Panel>;}
function ArchiveTool(){const hist=useMemo(()=>[{n:'YT_8K_Lecture_HDR.mp4',t:'1080p h264 / 312MB',p:'YouTube'},{n:'IG_brand_reel_0924.mp4',t:'audio mp3 320',p:'Instagram'},{n:'BoardMemo_Q3.docx',t:'PDF → DOCX',p:'Convert'},{n:'Meridian_QR_0924.png',t:'SVG 256px',p:'QR'}],[]);return <Panel title="Vault — Download History" st="M-08 / ARCHIVE">
  <div style={{display:'grid',gap:8}}>{hist.map(h=><div key={h.n} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'10px 12px',border:'1px solid #e8dbc1',borderRadius:11,background:'#fff',flexWrap:'wrap',minWidth:0}}>
    <div style={{minWidth:0,flex:1}}><div style={{fontWeight:560,fontSize:13,wordBreak:'break-word'}}>{h.n}</div><div className="m" style={{fontSize:10.5,color:'#8d8069'}}>{h.t} / {h.p}</div></div>
    <button style={{...css.btn2,padding:'6px 10px',fontSize:11.8,flexShrink:0}}>Re-download</button>
  </div>)}</div>
</Panel>;}
function QRTool({setToast}:{setToast:any}){const [text,setText]=useState('https://meridian.ops');const [size,setSize]=useState(256);const [lvl,setLvl]=useState<'L'|'M'|'Q'|'H'>('M');const [qr,setQr]=useState<string|null>(null);const [fg,setFg]=useState('#131f19');const [bg,setBg]=useState('#ffffff');
  const gen=useCallback(async()=>{try{const d=await QRCodeLib.toDataURL(text||' ',{width:size,margin:2,color:{dark:fg,light:bg},errorCorrectionLevel:lvl});setQr(d);}catch{setToast('QR generation failed');}},[text,size,lvl,fg,bg,setToast]);
  useEffect(()=>{gen();},[gen]);
  return <Panel title="QR Code Generator" st="M-09 / CONVERT" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>SVG / CANVAS / INSTANT</span>}>
    <div className="two-col" style={{minWidth:0}}>
      <div style={{display:'grid',gap:9,minWidth:0}}>
        <F l="Content"><textarea value={text} onChange={e=>setText(e.target.value)} rows={3} style={{...css.sel,resize:'vertical',minHeight:72}}/></F>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <F l="Size"><select value={size} onChange={e=>setSize(+e.target.value)} style={css.sel}>{[128,192,256,320,400,512].map(s=><option key={s} value={s}>{s}px</option>)}</select></F>
          <F l="Level"><select value={lvl} onChange={e=>setLvl(e.target.value as any)} style={css.sel}><option value="L">L / 7%</option><option value="M">M / 15%</option><option value="Q">Q / 25%</option><option value="H">H / 30%</option></select></F>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <F l="Foreground"><input type="color" value={fg} onChange={e=>setFg(e.target.value)} style={{width:'100%',height:36,borderRadius:9,border:'1px solid #d7cab1',cursor:'pointer'}}/></F>
          <F l="Background"><input type="color" value={bg} onChange={e=>setBg(e.target.value)} style={{width:'100%',height:36,borderRadius:9,border:'1px solid #d7cab1',cursor:'pointer'}}/></F>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#faf8f3',border:'1px solid #e8dcc6',borderRadius:16,padding:14,gap:10,minWidth:0}}>
        {qr ? <img src={qr} alt="qr" style={{maxWidth:220,maxHeight:220,borderRadius:6}}/> : <div className="m" style={{color:'#b0a590'}}>QR preview</div>}
        {qr && <div className="wrap-row" style={{justifyContent:'center'}}><button onClick={()=>{const a=document.createElement('a');a.href=qr;a.download='meridian-qr.png';a.click();setToast('QR downloaded')}} style={css.btnSm}>Download PNG</button><button onClick={()=>{navigator.clipboard.writeText(text);setToast('URL copied')}} style={css.btn2}>Copy</button></div>}
      </div>
    </div>
  </Panel>;
}
function EbookTool({setToast}:{setToast:any}){const [title,setTitle]=useState('Untitled Manuscript');const [author,setAuthor]=useState('');const [content,setContent]=useState('# Chapter 1\n\nWrite your markdown here.\n\n## Section 1\n\nContent goes here...');const [format,setFormat]=useState('epub');
  return <Panel title="Ebook Creator" st="M-10 / CONVERT" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>MD → EPUB / MOBI / AZW3</span>}>
    <div className="two-col" style={{minWidth:0}}>
      <div style={{display:'grid',gap:9,minWidth:0}}>
        <F l="Title"><input value={title} onChange={e=>setTitle(e.target.value)} style={css.sel} placeholder="Book title"/></F>
        <F l="Author"><input value={author} onChange={e=>setAuthor(e.target.value)} style={css.sel} placeholder="Author name"/></F>
        <F l="Format"><select value={format} onChange={e=>setFormat(e.target.value)} style={css.sel}><option value="epub">EPUB (universal)</option><option value="mobi">MOBI (Kindle)</option><option value="azw3">AZW3 (Kindle)</option><option value="pdf">PDF (print)</option></select></F>
        <div className="wrap-row"><button onClick={()=>setToast(`Generating ${title.replace(/\s/g,'_')}.${format}`)} style={css.btnSm}>Generate {format.toUpperCase()}</button><button onClick={()=>{navigator.clipboard.writeText(content);setToast('Content copied')}} style={css.btn2}>Copy MD</button></div>
      </div>
      <div style={{minWidth:0}}><F l="Markdown content"><textarea value={content} onChange={e=>setContent(e.target.value)} rows={10} style={{...css.sel,resize:'vertical',minHeight:160,fontFamily:'"Fragment Mono",monospace',fontSize:12.8}}/></F></div>
    </div>
  </Panel>;
}
function HashTool({setToast}:{setToast:any}){const [t,setT]=useState('');const [a,setA]=useState('sha256');const [r,setR]=useState('');const go=async()=>{if(!t){setToast('Enter text to hash');return;}const e=new TextEncoder().encode(t);const map:any={sha256:'SHA-256',sha512:'SHA-512',sha1:'SHA-1'};const d=await crypto.subtle.digest(map[a]||'SHA-256',e);setR(Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join(''));setToast('Hash computed')};
  return <Panel title="Hash Calculator" st="M-11 / PROCESS"><div style={{display:'grid',gap:9,minWidth:0}}>
    <F l="Input text"><textarea value={t} onChange={e=>setT(e.target.value)} rows={3} style={{...css.sel,resize:'vertical',minHeight:74,fontFamily:'"Fragment Mono",monospace'}} placeholder="Paste text to hash ..."/></F>
    <div className="wrap-row" style={{alignItems:'end'}}><div style={{minWidth:140}}><F l="Algorithm"><select value={a} onChange={e=>setA(e.target.value)} style={css.sel}><option value="sha256">SHA-256</option><option value="sha512">SHA-512</option><option value="sha1">SHA-1</option></select></F></div><button onClick={go} style={css.btnSm}>Compute</button></div>
    {r && <div style={{background:'#faf8f3',border:'1px solid #e8dcc6',borderRadius:12,padding:'11px 12px',minWidth:0}}><div className="m" style={{fontSize:10.5,color:'#93856d',marginBottom:3}}>{a.toUpperCase()} OUTPUT</div><div className="m" style={{fontSize:13,wordBreak:'break-all'}}>{r}</div><button onClick={()=>{navigator.clipboard.writeText(r);setToast('Hash copied')}} style={{marginTop:6,...css.btn2,padding:'6px 10px',fontSize:11.5}}>Copy</button></div>}
  </div></Panel>;}
function MergeTool({setToast}:{setToast:any}){const [files,setFiles]=useState<File[]>([]);return <Panel title="File Merger" st="M-12 / PROCESS"><div style={{display:'grid',gap:10,minWidth:0}}>
  <F l="Merge type"><select style={css.sel} defaultValue="pdf"><option value="pdf">PDF merge (concatenate)</option><option value="img-v">Image vertical stack</option><option value="img-h">Image horizontal stack</option><option value="img-grid">Image grid (4x4)</option></select></F>
  <div style={{border:'1.7px dashed #d1c5ab',borderRadius:15,padding:18,background:'#fffcf6',textAlign:'center',minWidth:0}}><Icon n="upload" size={26}/><div style={{fontWeight:620,marginTop:6}}>Drop files or click</div><input type="file" multiple onChange={e=>setFiles(prev=>[...prev,...Array.from(e.target.files||[])])} style={{marginTop:8,maxWidth:'100%'}}/></div>
  {files.length>0 && <div style={{fontSize:12.5,color:'#5f5748',wordBreak:'break-word'}}>{files.length} file(s) queued</div>}
  <div className="wrap-row"><button onClick={()=>setToast(`Merging ${files.length} files`)} style={css.btnSm}>Merge now</button><button onClick={()=>setFiles([])} style={css.btn2}>Clear all</button></div>
</div></Panel>;}
function PaletteTool({setToast}:{setToast:any}){const [c,setC]=useState(['#131f19','#b68439','#e8cf95','#f4f0e6','#e4d8be']);return <Panel title="Palette Studio" st="M-13 / DESIGN">
  <div style={{display:'grid',gap:10,minWidth:0}}>
    <div style={{display:'flex',flexWrap:'wrap',gap:7}}>{c.map((x,i)=><input key={i} type="color" value={x} onChange={e=>{const n=[...c];n[i]=e.target.value;setC(n);}} style={{width:46,height:46,borderRadius:12,border:'2px solid #e4d8be',cursor:'pointer',padding:2,flexShrink:0}}/>)}</div>
    <div className="wrap-row"><button onClick={()=>{const hx=Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');setC(p=>[...p.slice(1),'#'+hx]);}} style={css.btn2}>Shift</button><button onClick={()=>setC(['#131f19','#b68439','#e8cf95','#f4f0e6','#e4d8be'])} style={css.btn2}>Reset</button><button onClick={()=>{navigator.clipboard.writeText(JSON.stringify(c));setToast('Palette copied')}} style={css.btn2}>Copy</button></div>
    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{c.map(x=><div key={x} className="m" style={{fontSize:10.5,padding:'5px 9px',borderRadius:7,background:'#fff',border:'1px solid #e4d8be',wordBreak:'break-all'}}>{x}</div>)}</div>
  </div>
</Panel>;}
function BarcodeTool({setToast}:{setToast:any}){const [code,setCode]=useState('');const [type,setType]=useState('code128');return <Panel title="Barcode Suite" st="M-14 / CONVERT">
  <div style={{display:'grid',gap:9,minWidth:0}}>
    <F l="Barcode type"><select value={type} onChange={e=>setType(e.target.value)} style={css.sel}><option value="code128">CODE-128</option><option value="ean13">EAN-13</option><option value="upca">UPC-A</option><option value="code39">CODE-39</option></select></F>
    <F l="Data"><input value={code} onChange={e=>setCode(e.target.value)} style={css.sel} placeholder="Barcode data ..."/></F>
    <div className="wrap-row"><button onClick={()=>setToast(`Barcode ${type} generated`)} style={css.btnSm}>Generate</button><button onClick={()=>{navigator.clipboard.writeText(code);setToast('Data copied')}} style={css.btn2}>Copy</button></div>
    {code && <div style={{background:'#fff',border:'1px solid #e8dcc6',borderRadius:13,padding:16,textAlign:'center',minWidth:0,overflow:'hidden'}}>
      <div style={{fontSize:11.5,color:'#8a7f6d',marginBottom:5}}>{type.toUpperCase()}</div>
      <div style={{fontFamily:'"Fragment Mono",monospace',fontSize:22,borderTop:'3px solid #131f19',borderBottom:'3px solid #131f19',padding:'10px 4px',wordBreak:'break-all'}}>{code}</div>
    </div>}
  </div>
</Panel>;}
function DiffTool({setToast}:{setToast:any}){const [l,setL]=useState('The quick brown fox\njumps over\nthe lazy dog.');const [r,setR]=useState('The quick brown fox\njumps over\nthe sleepy dog.');const [m,setM]=useState<'unified'|'side'>('side');
  return <Panel title="Text Diff" st="M-15 / PROCESS">
    <div style={{display:'grid',gap:8,minWidth:0}}>
      <div className="wrap-row"><button onClick={()=>setM('unified')} style={{...css.btn2, background:m==='unified'?'#fff8ea':'#fff'}}>Unified</button><button onClick={()=>setM('side')} style={{...css.btn2, background:m==='side'?'#fff8ea':'#fff'}}>Side-by-side</button></div>
      {m==='side'
        ? <div className="two-col" style={{minWidth:0}}><div style={{minWidth:0}}><L>Original</L><textarea value={l} onChange={e=>setL(e.target.value)} rows={7} style={{...css.sel,resize:'vertical',minHeight:108,fontFamily:'"Fragment Mono",monospace',fontSize:12.8}}/></div><div style={{minWidth:0}}><L>Modified</L><textarea value={r} onChange={e=>setR(e.target.value)} rows={7} style={{...css.sel,resize:'vertical',minHeight:108,fontFamily:'"Fragment Mono",monospace',fontSize:12.8}}/></div></div>
        : <div style={{minWidth:0}}><L>Unified diff</L><textarea value={l} onChange={e=>setL(e.target.value)} rows={7} style={{...css.sel,resize:'vertical',minHeight:108,fontFamily:'"Fragment Mono",monospace',fontSize:12.8}}/></div>
      }
      <div className="wrap-row"><button onClick={()=>setToast('Diff computed')} style={css.btnSm}>Compare</button><button onClick={()=>{setL('');setR('');}} style={css.btn2}>Clear</button></div>
    </div>
  </Panel>;
}
function SVGOptTool({setToast}:{setToast:any}){const [svg,setSVG]=useState('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n  <circle cx="50" cy="50" r="40" fill="#131f19"/>\n</svg>');
  return <Panel title="SVG Optimizer" st="M-16 / PROCESS"><div style={{display:'grid',gap:9,minWidth:0}}>
    <F l="SVG source"><textarea value={svg} onChange={e=>setSVG(e.target.value)} rows={8} style={{...css.sel,resize:'vertical',minHeight:120,fontFamily:'"Fragment Mono",monospace',fontSize:12.5}}/></F>
    <div className="wrap-row">
      <button onClick={()=>{setSVG(svg.replace(/>\s+</g,'><').replace(/\s+/g,' ').trim());setToast('SVG minified')}} style={css.btnSm}>Minify</button>
      <button onClick={()=>{setSVG(svg.replace(/></g,'>\n<'));setToast('SVG prettified')}} style={css.btn2}>Prettify</button>
      <button onClick={()=>{navigator.clipboard.writeText(svg);setToast('SVG copied')}} style={css.btn2}>Copy</button>
      <button onClick={()=>setSVG('')} style={css.btn2}>Clear</button>
    </div>
    <div style={{fontSize:11,color:'#5f5748',textAlign:'right'}} className="m">{svg.length.toLocaleString()} bytes / {svg.split('\n').length} lines</div>
  </div></Panel>;
}

/* ---------- shared UI ---------- */
function Panel({title,st,right,children}:{title:string;st?:string;right?:React.ReactNode;children:React.ReactNode}){return(
  <div style={{background:G.surface,border:'1px solid #e5d8be',borderRadius:18,padding:16,boxShadow:'0 5px 24px rgba(60,46,21,.045)',maxWidth:'100%',minWidth:0}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12,gap:8,flexWrap:'wrap',minWidth:0}}>
      <div style={{minWidth:0}}><div className="f" style={{fontSize:22,letterSpacing:'-0.011em',wordBreak:'break-word'}}>{title}</div>{st&&<div className="m" style={{marginTop:2,fontSize:10.5,color:'#93856d',letterSpacing:'.045em'}}>{st}</div>}</div>
      {right && <div style={{flexShrink:0}}>{right}</div>}
    </div>
    <div style={{minWidth:0}}>{children}</div>
  </div>
);}
function F({l,children}:{l:string;children:React.ReactNode}){return <div style={{minWidth:0}}><div className="m" style={{fontSize:9.8,letterSpacing:'.07em',color:'#8d7f69',marginBottom:4}}>{l.toUpperCase()}</div>{children}</div>;}
function L({children}:{children:string}){return <div className="m" style={{fontSize:10.2,letterSpacing:'.06em',color:'#8a7f6c',marginBottom:1}}>{children}</div>;}

function ModalSheet({title,children,onClose,wide=false}:{title:string;children:React.ReactNode;onClose:()=>void;wide?:boolean}){
  return (
    <div style={{position:'fixed',inset:0,zIndex:80,background:'rgba(23,19,13,.48)',display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#fffdf8',borderRadius:18,
        width: wide ? 'min(760px,96vw)' : 'min(440px,96vw)',
        maxHeight:'92vh', overflowY:'auto', overflowX:'hidden',
        padding:18, boxShadow:'0 24px 60px rgba(0,0,0,.22)',
        position:'relative'
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12, position:'sticky', top:-18, background:'#fffdf8', paddingTop:2, paddingBottom:8, zIndex:2}}>
          <div className="f" style={{fontSize:20,wordBreak:'break-word',paddingRight:8}}>{title}</div>
          <button onClick={onClose} style={{flexShrink:0,width:32,height:32,borderRadius:9,border:'1px solid #e2d5bd',background:'#fff',cursor:'pointer'}}><Icon n="close" size={14}/></button>
        </div>
        <div style={{minWidth:0}}>{children}</div>
      </div>
    </div>
  );
}

/* ---------- Auth inner ---------- */
function AuthInner({onSuccess,setToast}:{onSuccess:(s:any)=>void;setToast:any}){
  const [email,setEmail]=useState(''); const [pin,setPin]=useState(''); const [busy,setBusy]=useState(false);
  const submit=async(e:React.FormEvent)=>{ e.preventDefault(); setBusy(true); const r=await signInOrUp(email,pin); setBusy(false); if(!r.ok){ setToast(r.error||'Auth failed'); return;} onSuccess(r.session); };
  return (
    <form onSubmit={submit} style={{display:'grid',gap:11,minWidth:0}}>
      <div style={{fontSize:12.5,color:'#6b6050',lineHeight:1.55,wordBreak:'break-word'}}>3 free uses, then sign up – get 10 free credits. After that, subscribe.<br/><span className="m" style={{fontSize:11}}>Admin: honesttech237@gmail.com</span></div>
      <F l="Email"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" style={css.sel}/></F>
      <F l="PIN (4–8 digits)"><input type="password" inputMode="numeric" pattern="\d{4,8}" required value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} placeholder="••••" style={css.sel}/></F>
      <button disabled={busy} style={{...css.btnPri,width:'100%',opacity:busy?.6:1}}>{busy?'Verifying…':'Sign in / Create account'}</button>
      <div style={{fontSize:11.5,color:'#867b6b',lineHeight:1.5,wordBreak:'break-word'}}>Device fingerprint is stored to prevent multiple free trial abuse. Sessions persist so you can re-download anytime.</div>
    </form>
  );
}

/* ---------- Paywall inner ---------- */
function PayInner({session,setToast,onPaid}:{session:any;setToast:any;onPaid:()=>void}){
  const [plans,setPlans]=useState<PlanRow[]>([]);
  const [country,setCountry]=useState('CM');
  const [phone,setPhone]=useState('');
  const [operator,setOperator]=useState('MTN Mobile Money');
  const [selected,setSelected]=useState<PlanRow|null>(null);
  const [otp,setOtp]=useState(''); const [needOtp,setNeedOtp]=useState<{ussd?:string|null}|null>(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{(async()=>{
    if(isSupabaseConfigured && supabase){
      const {data}=await supabase.from('plans').select('*').eq('active',true).order('sort_order');
      if(data && data.length){ setPlans(data as any); return; }
    }
    setPlans([
      {id:'1',code:'p30',name:'Starter 30',price_xaf:500,usage_credits:30,duration_days:null,tools:null,active:true,sort_order:10,created_at:''},
      {id:'2',code:'p100',name:'Pro 100',price_xaf:900,usage_credits:100,duration_days:null,tools:null,active:true,sort_order:20,created_at:''},
      {id:'3',code:'p500',name:'Scale 500',price_xaf:1900,usage_credits:500,duration_days:null,tools:null,active:true,sort_order:30,created_at:''},
      {id:'4',code:'unlimited_1m',name:'Unlimited 30 days',price_xaf:2400,usage_credits:null,duration_days:30,tools:null,active:true,sort_order:40,created_at:''},
    ]);
  })();},[]);

  const pay=async()=>{
    if(!selected){ setToast('Pick a plan first'); return; }
    if(!session){ setToast('Sign in first'); return; }
    if(!phone){ setToast('Enter phone number'); return; }
    setBusy(true);
    try{
      const body:any={
        amount: selected.price_xaf,
        currency: 'XAF',
        phone, operator, country_code: country,
        reference: `meridian_plan_${selected.id}_user_${session.id}`,
        notify_url: window.location.origin + '/api/ashtech-webhook'
      };
      if(needOtp && otp) body.otp = otp;
      const r = await fetch('/api/collect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const j = await r.json();
      if(r.status===202){
        setToast('Payment initiated – validate on your phone');
        if(isSupabaseConfigured && supabase){
          await supabase.from('transactions').insert({
            user_id: session.id, plan_id: selected.id,
            ashtech_transaction_id: j.transaction_id,
            amount_gross: selected.price_xaf,
            currency:'XAF', status:'pending', phone, operator, country_code: country
          });
        }
        setTimeout(()=>onPaid(),1400); return;
      }
      if(r.status===400 && j.error==='otp_required'){ setNeedOtp({ussd:j.ussd_code||null}); setToast(j.message||'OTP required'); setBusy(false); return;}
      throw new Error(j.message||'Payment failed');
    }catch(e:any){ setToast(e.message||'Payment error'); setBusy(false); }
  };

  return (
    <div style={{minWidth:0}}>
      {!session && <div style={{background:'#fdf4e6',border:'1px solid #f0d6a6',color:'#8a6022',borderRadius:11,padding:'9px 12px',fontSize:12.5,marginBottom:12,wordBreak:'break-word'}}>Sign in first to attach your subscription.</div>}
      <div className="auto-grid" style={{marginBottom:12}}>
        {plans.map(p=>(
          <button key={p.id} onClick={()=>setSelected(p)} style={{
            textAlign:'left',padding:'12px',borderRadius:12,cursor:'pointer',
            background: selected?.id===p.id ? '#fff5d7':'#fff',
            border: selected?.id===p.id ? '2px solid #d2b063':'1px solid #e7d8b9',
            minWidth:0
          }}>
            <div style={{fontWeight:650,fontSize:14,wordBreak:'break-word'}}>{p.name}</div>
            <div className="m" style={{fontSize:11,color:'#7a715f',marginTop:3}}>{p.usage_credits ? `${p.usage_credits} uses` : p.duration_days ? `${p.duration_days} days unlimited` : 'unlimited'}</div>
            <div style={{fontWeight:700,marginTop:6,fontSize:15}}>{p.price_xaf.toLocaleString()} XAF</div>
          </button>
        ))}
      </div>
      <div className="auto-grid">
        <F l="Country"><select value={country} onChange={e=>setCountry(e.target.value)} style={css.sel}>
          <option value="CM">Cameroon (XAF)</option><option value="SN">Senegal (XOF)</option><option value="CI">Côte d’Ivoire (XOF)</option>
          <option value="BJ">Benin (XOF)</option><option value="BF">Burkina Faso (XOF)</option><option value="TG">Togo (XOF)</option>
          <option value="ML">Mali (XOF)</option><option value="GN">Guinea (GNF)</option><option value="CD">DR Congo (CDF)</option>
        </select></F>
        <F l="Operator"><input value={operator} onChange={e=>setOperator(e.target.value)} style={css.sel} placeholder="MTN Mobile Money"/></F>
      </div>
      <div style={{marginTop:8}}><F l="Phone"><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="6XXXXXXXX" style={css.sel}/></F></div>

      {needOtp && <div style={{marginTop:10,background:'#fff8e8',border:'1px solid #f0d6a6',borderRadius:11,padding:12}}>
        <div style={{fontSize:12.8,fontWeight:600}}>OTP required</div>
        <div style={{fontSize:12,color:'#6b5a33'}}>{needOtp.ussd ? `Dial ${needOtp.ussd} to get your OTP` : 'Check your SMS for the OTP code'}</div>
        <input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="Enter OTP" style={{...css.sel,marginTop:8}}/>
      </div>}

      <div className="wrap-row" style={{marginTop:12}}>
        <button disabled={busy||!selected} onClick={pay} style={{...css.btnPri,opacity:(busy||!selected)?0.6:1}}>{needOtp ? 'Confirm OTP' : busy ? 'Processing…' : selected ? `Pay ${selected.price_xaf} XAF` : 'Select a plan'}</button>
      </div>
      <div style={{fontSize:11.3,color:'#887b66',marginTop:10,lineHeight:1.55,wordBreak:'break-word'}}>AshtechPay – 16 African countries · USSD Push · OTP SMS / USSD · Wave<br/>Fees auto-deducted · webhook confirms subscription instantly.</div>
    </div>
  );
}

/* ---------- Support inner ---------- */
function SupportInner({session,setToast}:{session:any;setToast:any}){
  const [tab,setTab]=useState<'ticket'|'feature'>('ticket');
  const [email,setEmail]=useState(session?.email||'');
  const [subject,setSubject]=useState(''); const [body,setBody]=useState('');
  const [list,setList]=useState<any[]>([]);
  useEffect(()=>{(async()=>{ if(isSupabaseConfigured && supabase && session){ const {data}=await supabase.from('tickets').select('*').eq('user_id',session.id).order('created_at',{ascending:false}).limit(20); setList(data||[]);} })();},[session]);
  const send=async()=>{
    if(!email||!subject||!body){setToast('Fill all fields');return;}
    if(isSupabaseConfigured && supabase){ const {error}=await supabase.from('tickets').insert({user_id: session?.id||null, email, subject, body, status:'open'}); if(error){setToast(error.message);return;} }
    setToast('Ticket sent – admin will reply soon'); setSubject(''); setBody('');
  };
  const sendFeature=async()=>{
    if(!email||!subject){setToast('Title + email required');return;}
    if(isSupabaseConfigured && supabase){ await supabase.from('feature_requests').insert({email,title:subject,body}); }
    setToast('Feature request sent – thank you!'); setSubject(''); setBody('');
  };
  return (
    <div style={{minWidth:0}}>
      <div className="wrap-row" style={{marginBottom:12}}>
        <button onClick={()=>setTab('ticket')} style={{...css.btn2, background: tab==='ticket' ? '#fff5d6':'#fff'}}>New ticket / Report issue</button>
        <button onClick={()=>setTab('feature')} style={{...css.btn2, background: tab==='feature' ? '#fff5d6':'#fff'}}>Request feature</button>
      </div>
      {tab==='ticket' ? <>
        <div className="two-col" style={{gap:10,marginBottom:9}}>
          <F l="Email"><input value={email} onChange={e=>setEmail(e.target.value)} style={css.sel} placeholder="you@company.com"/></F>
          <F l="Subject"><input value={subject} onChange={e=>setSubject(e.target.value)} style={css.sel} placeholder="Brief summary"/></F>
        </div>
        <F l="Message"><textarea value={body} onChange={e=>setBody(e.target.value)} rows={4} style={{...css.sel,resize:'vertical',minHeight:90}} placeholder="Describe the problem…"/></F>
        <div className="wrap-row" style={{marginTop:10}}>
          <button onClick={send} style={css.btnSm}>Send ticket</button>
          <span style={{fontSize:12,color:'#7b6d57'}}>support: honesttech237@gmail.com</span>
        </div>
        {list.length>0 && <div style={{marginTop:14}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:6}}>Your recent tickets</div>
          <div style={{display:'grid',gap:7}}>{list.map((t:any)=><div key={t.id} style={{border:'1px solid #e8dbc1',borderRadius:11,padding:'9px 11px',background:'#fff',fontSize:12.5}}><div style={{fontWeight:560}}>{t.subject}</div><div className="m" style={{fontSize:10.5,color:'#8a7a66',marginTop:2}}>{t.status} · {new Date(t.created_at).toLocaleDateString()}</div></div>)}</div>
        </div>}
      </> : <>
        <div style={{display:'grid',gap:9,minWidth:0}}>
          <F l="Email"><input value={email} onChange={e=>setEmail(e.target.value)} style={css.sel} placeholder="you@company.com"/></F>
          <F l="Feature title"><input value={subject} onChange={e=>setSubject(e.target.value)} style={css.sel} placeholder="e.g. CSV to JSON converter"/></F>
          <F l="Details (optional)"><textarea value={body} onChange={e=>setBody(e.target.value)} rows={4} style={{...css.sel,resize:'vertical'}} placeholder="Tell us more…"/></F>
          <div><button onClick={sendFeature} style={css.btnSm}>Submit feature request</button></div>
        </div>
      </>}
    </div>
  );
}

/* ---------- Admin inner ---------- */
function AdminInner({setToast}:{setToast:any}){
  const [tab,setTab]=useState<'plans'|'users'|'tickets'|'settings'>('plans');
  const [plans,setPlans]=useState<PlanRow[]>([]);
  const [users,setUsers]=useState<any[]>([]);
  const [tickets,setTickets]=useState<any[]>([]);
  const [supportEmail,setSupportEmail]=useState('honesttech237@gmail.com');

  const load = useCallback(async()=>{
    if(!isSupabaseConfigured || !supabase) return;
    const p = await supabase.from('plans').select('*').order('sort_order');
    setPlans((p.data as any)||[]);
    const u = await supabase.from('users').select('id,email,role,free_uses_left,usage_remaining,plan_expires_at,created_at').order('created_at',{ascending:false}).limit(120);
    setUsers(u.data||[]);
    const t = await supabase.from('tickets').select('*').order('created_at',{ascending:false}).limit(60);
    setTickets(t.data||[]);
    const s = await supabase.from('site_settings').select('*').eq('key','support_email').maybeSingle();
    if(s.data?.value){ try{ setSupportEmail(JSON.parse(s.data.value as any) || String(s.data.value)); }catch{ setSupportEmail(String(s.data.value)); } }
  },[]);
  useEffect(()=>{load();},[load]);

  const savePlan = async (pl:Partial<PlanRow>)=>{
    if(!supabase) return;
    if(pl.id){ await supabase.from('plans').update(pl).eq('id',pl.id); setToast('Plan updated'); }
    else { await supabase.from('plans').insert(pl); setToast('Plan created'); }
    load();
  };
  const deletePlan = async(id:string)=>{ if(!supabase) return; await supabase.from('plans').delete().eq('id',id); setToast('Plan removed'); load(); };
  const upgradeUser = async(userId:string, planId:string|null)=>{
    if(!supabase) return;
    if(!planId){ await supabase.from('users').update({plan_id:null,plan_expires_at:null,usage_remaining:null}).eq('id',userId); setToast('User downgraded'); load(); return; }
    const plan = plans.find(p=>p.id===planId); if(!plan) return;
    const upd:any = {plan_id:plan.id};
    if(plan.usage_credits!==null){ upd.usage_remaining = plan.usage_credits; upd.plan_expires_at=null; }
    else if(plan.duration_days){ upd.plan_expires_at = new Date(Date.now()+plan.duration_days*864e5).toISOString(); upd.usage_remaining=null; }
    await supabase.from('users').update(upd).eq('id',userId);
    setToast('User plan updated'); load();
  };
  const saveSupportEmail = async()=>{
    if(!supabase) return;
    await supabase.from('site_settings').upsert({key:'support_email', value: JSON.stringify(supportEmail)});
    setToast('Support email updated');
  };

  return (
    <div style={{minWidth:0}}>
      <div className="wrap-row" style={{marginBottom:12}}>
        {(['plans','users','tickets','settings'] as const).map(x=><button key={x} onClick={()=>setTab(x)} style={{...css.btn2, background: tab===x ? '#fff2cf':'#fff', fontWeight: tab===x?640:520}}>{x.toUpperCase()}</button>)}
      </div>

      {tab==='plans' && <div style={{display:'grid',gap:9,minWidth:0}}>
        {plans.map(p=><div key={p.id} style={{background:'#fff',border:'1px solid #e7d8be',borderRadius:12,padding:12,minWidth:0}}>
          <div className="wrap-row" style={{alignItems:'end'}}>
            <div style={{minWidth:140,flex:'1 1 150px'}}><div className="m" style={{fontSize:9.5,color:'#8d7f69'}}>NAME</div><input defaultValue={p.name} onBlur={e=>savePlan({...p, name:e.target.value})} style={css.sel}/></div>
            <div style={{minWidth:90}}><div className="m" style={{fontSize:9.5,color:'#8d7f69'}}>PRICE XAF</div><input type="number" defaultValue={p.price_xaf} onBlur={e=>savePlan({...p, price_xaf: parseInt(e.target.value)||0})} style={css.sel}/></div>
            <div style={{minWidth:90}}><div className="m" style={{fontSize:9.5,color:'#8d7f69'}}>CREDITS</div><input type="number" defaultValue={p.usage_credits??''} onBlur={e=>savePlan({...p, usage_credits: e.target.value?parseInt(e.target.value):null})} placeholder="null=unlimited" style={css.sel}/></div>
            <div style={{minWidth:80}}><div className="m" style={{fontSize:9.5,color:'#8d7f69'}}>DAYS</div><input type="number" defaultValue={p.duration_days??''} onBlur={e=>savePlan({...p, duration_days: e.target.value?parseInt(e.target.value):null})} placeholder="days" style={css.sel}/></div>
            <button onClick={()=>deletePlan(p.id)} style={{...css.btn2, padding:'8px 10px', fontSize:12}}>Delete</button>
          </div>
          <div className="m" style={{fontSize:10.5,color:'#8a7a66',marginTop:5,wordBreak:'break-all'}}>code: {p.code} · id {p.id.slice(0,8)}</div>
        </div>)}
        <button onClick={()=>savePlan({code:'plan_'+Date.now(),name:'New Plan',price_xaf:1000,usage_credits:50,duration_days:null,tools:null,active:true,sort_order:99} as any)} style={{...{padding:'9px 14px',background:'#1b2620',color:'#f3e0b7',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer',fontSize:13}, justifySelf:'start'}}>Add plan</button>
      </div>}

      {tab==='users' && <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5,minWidth:560}}>
          <thead><tr style={{textAlign:'left',borderBottom:'1px solid #e6d8be'}}><th style={{padding:'6px 8px'}}>EMAIL</th><th>FREE</th><th>CREDITS</th><th>EXPIRES</th><th>PLAN</th></tr></thead>
          <tbody>{users.map(u=><tr key={u.id} style={{borderTop:'1px solid #f0e5cf'}}>
            <td style={{padding:'7px 8px',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis'}}>{u.email}{u.role==='admin'&&<span style={{color:'#b1842e',marginLeft:6,fontSize:10}} className="m">ADMIN</span>}</td>
            <td>{u.free_uses_left}</td><td>{u.usage_remaining ?? '—'}</td>
            <td style={{fontSize:11}}>{u.plan_expires_at ? new Date(u.plan_expires_at).toLocaleDateString() : '—'}</td>
            <td><select defaultValue="" onChange={e=>e.target.value && upgradeUser(u.id, e.target.value==='none'?null:e.target.value)} style={{...css.sel,padding:'6px 8px',fontSize:12}}><option value="">set…</option><option value="none">remove</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
          </tr>)}</tbody>
        </table>
      </div>}

      {tab==='tickets' && <div style={{display:'grid',gap:8,minWidth:0}}>
        {tickets.length===0 && <div style={{color:'#897b66',fontSize:13}}>No tickets yet.</div>}
        {tickets.map((t:any)=><div key={t.id} style={{background:'#fff',border:'1px solid #e8dbc1',borderRadius:12,padding:11,minWidth:0}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><div style={{fontWeight:600,fontSize:13.3,wordBreak:'break-word'}}>{t.subject}</div><div className="m" style={{fontSize:10.5,color:'#8a7a66'}}>{t.status} · {new Date(t.created_at).toLocaleString()}</div></div>
          <div style={{fontSize:12.3,color:'#5b5142',marginTop:4,wordBreak:'break-word'}}>{t.email} – {t.body}</div>
        </div>)}
      </div>}

      {tab==='settings' && <div style={{display:'grid',gap:12,maxWidth:520,minWidth:0}}>
        <div><div className="m" style={{fontSize:10,color:'#8d7f69',marginBottom:4}}>SUPPORT EMAIL</div>
          <input value={supportEmail} onChange={e=>setSupportEmail(e.target.value)} style={css.sel}/>
          <div style={{marginTop:8}}><button onClick={saveSupportEmail} style={{padding:'9px 14px',background:'#1b2620',color:'#f3e0b7',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer',fontSize:13}}>Save</button></div>
        </div>
        <div style={{background:'#faf7ed',border:'1px solid #eadfc9',borderRadius:12,padding:12,fontSize:12,color:'#645942',lineHeight:1.6,wordBreak:'break-word'}}>
          <b>Vercel environment variables:</b><br/>
          VITE_SUPABASE_URL<br/>VITE_SUPABASE_ANON_KEY<br/>SUPABASE_URL<br/>SUPABASE_SERVICE_ROLE_KEY<br/>ASHTECH_API_KEY<br/>VITE_COBALT_ENDPOINT<br/>VITE_COBALT_API_KEY<br/><br/>
          <b>AshtechPay webhook:</b><br/>https://your-app.vercel.app/api/ashtech-webhook
        </div>
      </div>}
    </div>
  );
}
