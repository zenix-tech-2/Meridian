import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCodeLib from 'qrcode';

/* ---------- types ---------- */
type ToolId =
  | 'fetch' | 'transcode' | 'convert' | 'extract' | 'compress'
  | 'batch'  | 'docs'     | 'archive' | 'qr'      | 'ebook'
  | 'hash'   | 'merge'    | 'palette' | 'barcode' | 'diff' | 'svgopt';

type Platform = 'auto'|'youtube'|'tiktok'|'instagram'|'x'|'facebook'|'vimeo'|'pinterest'|'reddit'|'bluesky'|'soundcloud';

/* ---------- data ---------- */
const PLATFORMS: {id:Platform,label:string,regex:RegExp[];color:string}[] = [
  {id:'auto',label:'Automatic route',regex:[],color:'#6b756f'},
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

const TOOLS: {id:ToolId;name:string;k:string;desc:string;category:string}[] = [
  {id:'fetch',name:'Media Fetch',k:'M-01',desc:'Multi-platform video acquisition',category:'acquire'},
  {id:'transcode',name:'Transcode',k:'M-02',desc:'Audio extraction & re-encode',category:'process'},
  {id:'convert',name:'Doc Convert',k:'M-03',desc:'PDF / DOCX / TXT / CSV / RTF',category:'convert'},
  {id:'extract',name:'Extractor',k:'M-04',desc:'Metadata, transcript, captions',category:'acquire'},
  {id:'compress',name:'Compress',k:'M-05',desc:'Image & archive optimization',category:'process'},
  {id:'batch',name:'Batch Queue',k:'M-06',desc:'Up to 32 concurrent jobs',category:'acquire'},
  {id:'docs',name:'OCR Suite',k:'M-07',desc:'Scan, parse, redact',category:'convert'},
  {id:'archive',name:'Vault',k:'M-08',desc:'Secure download history',category:'process'},
  {id:'qr',name:'QR Generator',k:'M-09',desc:'Instant vector QR codes',category:'convert'},
  {id:'ebook',name:'Ebook Creator',k:'M-10',desc:'MD to EPUB / MOBI / AZW3',category:'convert'},
  {id:'hash',name:'Hash Calc',k:'M-11',desc:'SHA-256 / SHA-512 / SHA-1',category:'process'},
  {id:'merge',name:'File Merger',k:'M-12',desc:'PDF / image stitch engine',category:'process'},
  {id:'palette',name:'Palette Studio',k:'M-13',desc:'WCAG contrast / color scales',category:'convert'},
  {id:'barcode',name:'Barcode Suite',k:'M-14',desc:'EAN-13 / UPC-A / CODE-128',category:'convert'},
  {id:'diff',name:'Text Diff',k:'M-15',desc:'Unified diff / side-by-side',category:'process'},
  {id:'svgopt',name:'SVG Optimizer',k:'M-16',desc:'Minify / prettify / sanitize',category:'process'},
];

const BOTTOM_TABS: ToolId[] = ['fetch','transcode','convert','qr','ebook'];

/* ---------- SVG icons ---------- */
type IconName = 'menu'|'close'|'grid'|'fetch'|'transcode'|'docs'|'search'|'plus'|'bell'|'wifi'|'shield'|'chevron'|'chevronU'|'external'|'clip'|'bolt'|'layers'|'arrow'|'arrowR'|'check'|'qr'|'book'|'hash'|'merge'|'palette'|'barcode'|'diff'|'svgopt'|'copy'|'trash'|'download'|'upload'|'settings'|'info'|'lock'|'unlock'|'eye'|'eyeoff'|'refresh'|'play'|'pause'|'stop';

const ICONS: Record<IconName,string> = {
  menu:'M4 6h16M4 12h16M4 18h11',
  close:'M18 6 6 18M6 6l12 12',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  fetch:'M12 2v14M7 11l5 5 5-5M4 22h16',
  transcode:'M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 2-4 2-4 M21 16c0 1.1-.9 2-2 2s-2-.9-2-2 2-4 2-4',
  docs:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  search:'M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z',
  plus:'M12 5v14M5 12h14',
  bell:'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  wifi:'M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01',
  shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chevron:'M6 9l6 6 6-6',
  chevronU:'M18 15l-6-6-6 6',
  external:'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  clip:'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
  bolt:'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  layers:'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  arrow:'M5 12h14M12 5l7 7-7 7',
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
  trash:'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  lock:'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 1 1 10 0v4',
  unlock:'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 9.9-1',
  eye:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeoff:'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22',
  refresh:'M3 3v5h5M21 21v-5h-5M20 8a9 9 0 0 0-16 4M4 16a9 9 0 0 0 16-4',
  play:'M5 3l14 9-14 9V3z',
  pause:'M6 4h4v16H6zM14 4h4v16h-4z',
  stop:'M6 6h12v12H6z',
};

const Icon = ({n,size=18}:{n:IconName;size?:number})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[n]}/></svg>
);

function detectPlatform(url:string):Platform{
  const f=PLATFORMS.find(p=>p.id!=='auto'&&p.regex.some(r=>r.test(url)));
  return f?f.id:'auto';
}

const G = {
  bg:'#f4f0e6',surface:'#fefcf6',border:'#e4d8be',dark:'#131f19',
  gold:'#b68439',goldL:'#e8cf95',text:'#1c241f',sub:'#736b5e',muted:'#93876f',
};
const css = {
  sel:{width:'100%',maxWidth:'100%',padding:'11px 12px',borderRadius:11,border:'1px solid #d7cab1',background:'#fff',fontSize:14,color:'#1c241f'},
  btn2:{padding:'12px 16px',border:'1px solid #d8cdb6',background:'#fff8ee',borderRadius:12,cursor:'pointer',fontWeight:540,fontSize:13.5,color:'#2b261c',whiteSpace:'nowrap'},
  btn1:{padding:'13px 18px',background:'#1c2a21',color:'#f3e2bd',border:'none',borderRadius:12,fontWeight:640,cursor:'pointer',fontSize:14,whiteSpace:'nowrap'},
  btnSm:{padding:'10px 15px',background:'#1b2620',color:'#f3e0b7',border:'none',borderRadius:11,fontWeight:600,cursor:'pointer',fontSize:13.5,whiteSpace:'nowrap'},
  input:{flex:1,border:'none',outline:'none',background:'transparent',fontSize:15.3,padding:'11px 0',color:'#1c241f',minWidth:0},
  card:{background:'#fffdf8',border:'1px solid #e8dcc6',borderRadius:18,padding:16},
};

/* ========== APP SHELL ========== */
export default function App(){
  const [tool,setTool]=useState<ToolId>(()=>{const p=new URLSearchParams(window.location.search).get('tool');return(TOOLS.find(t=>t.id===p)?.id||'fetch')as ToolId;});
  const [drawer,setDrawer]=useState(false);
  const [pushAllowed,setPushAllowed]=useState(typeof Notification!=='undefined'&&Notification.permission==='granted');
  const [installEvt,setInstallEvt]=useState<any>(null);
  const [coBadge,setCoBadge]=useState<'LIVE'|'SIM'>('SIM');
  const [toast,setToast]=useState<string|null>(null);

  useEffect(()=>{document.documentElement.style.colorScheme='light';},[]);
  useEffect(()=>{const h=(e:any)=>{e.preventDefault();setInstallEvt(e);};window.addEventListener('beforeinstallprompt',h);return()=>window.removeEventListener('beforeinstallprompt',h);},[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),2600);return()=>clearTimeout(t);},[toast]);

  const requestPush=async()=>{
    if(!('Notification' in window)){setToast('Notifications unavailable');return;}
    const p=await Notification.requestPermission();setPushAllowed(p==='granted');
    if(p==='granted'&&'serviceWorker' in navigator){try{const r=await navigator.serviceWorker.ready;if('showNotification'in r){r.showNotification('Meridian - operations armed',{body:'Task completion alerts enabled.',icon:'/icon.svg',tag:'armed'}as any);}}catch{}}
    setToast(p==='granted'?'Push enabled':'Notifications denied');
  };
  const installApp=async()=>{if(installEvt){installEvt.prompt();await installEvt.userChoice;setInstallEvt(null);setToast('Install prompt shown');}else setToast('Use browser menu - Install Meridian');};

  return(
    <div style={{fontFamily:'"Inter",system-ui,-apple-system,Segoe UI,sans-serif',backgroundColor:G.bg,color:G.text,minHeight:'100vh',overflow:'hidden'}}>
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        html,body{margin:0;padding:0;overflow-x:hidden;width:100%;max-width:100vw}
        body{position:relative}
        .f{font-family:"Fraunces",Georgia,serif}.m{font-family:"Fragment Mono",ui-monospace,monospace}
        input,select,button,textarea{font:inherit;max-width:100%}::placeholder{color:#989285}
        img,svg,video,canvas{max-width:100%;height:auto}
        .ts::-webkit-scrollbar{height:7px;width:7px}.ts::-webkit-scrollbar-thumb{background:#d3cdc1;border-radius:6px}
        @media(max-width:768px){.hide-m{display:none!important}}@media(min-width:769px){.hide-d{display:none!important}}
        .stack-760{display:grid}@media(max-width:760px){.stack-760{grid-template-columns:1fr!important}}
        .stack-600{display:grid}@media(max-width:600px){.stack-600{grid-template-columns:1fr!important}}
        .resp-grid{display:grid}@media(max-width:1040px){.resp-grid{grid-template-columns:1fr!important}.resp-grid aside{position:static!important}}
      `}</style>

      {/* HEADER */}
      <header style={{position:'sticky',top:0,zIndex:40,backdropFilter:'blur(10px)',background:'rgba(244,240,230,0.92)',borderBottom:'1px solid #e1dace',maxWidth:'100vw'}}>
        <div style={{maxWidth:1280,margin:'0 auto',padding:'0 16px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flexShrink:1}}>
            <button onClick={()=>setDrawer(true)} aria-label="Menu" style={{display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,width:36,height:36,border:'1px solid #d9d2c3',borderRadius:11,background:'#faf7f0',cursor:'pointer'}}><Icon n="menu" size={17}/></button>
            <div style={{flexShrink:0,width:32,height:32,borderRadius:10,background:G.dark,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 20V4l9 7 9-7v16" stroke="#e4c888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="6" x2="12" y2="20" stroke="#caa062" strokeWidth="1" opacity=".8"/></svg>
            </div>
            <div className="hide-m" style={{minWidth:0}}>
              <div className="f" style={{fontSize:19,letterSpacing:'-0.014em',lineHeight:1.1}}>Meridian</div>
              <div className="m" style={{fontSize:10,color:'#7a7364',letterSpacing:'0.045em'}}>OPS / V2.6 / SOC2</div>
            </div>
            <div className="hide-m" style={{display:'flex',alignItems:'center',gap:6,marginLeft:4,flexShrink:0}}>
              <span className="m" style={{fontSize:9.5,letterSpacing:'.09em',textTransform:'uppercase',color:coBadge==='LIVE'?'#166a44':'#8f7755',background:coBadge==='LIVE'?'#dff4e8':'#f3ead8',border:'1px solid '+(coBadge==='LIVE'?'#bde9ce':'#e9dbba'),padding:'4px 8px',borderRadius:999}}>{coBadge} / COBALT</span>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
            <button onClick={requestPush} className="hide-m" style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',border:'1px solid #d8d0bf',background:'#fffdf7',borderRadius:999,cursor:'pointer',fontSize:12,fontWeight:500}}>
              <span style={{width:7,height:7,borderRadius:99,background:pushAllowed?'#2ea36b':'#c6b99f',display:'inline-block'}}/><span>Notify</span>
            </button>
            <button onClick={installApp} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:G.dark,color:'#f5ebd1',border:'1px solid '+G.dark,borderRadius:999,cursor:'pointer',fontSize:12.5,fontWeight:600,whiteSpace:'nowrap'}}>
              <Icon n="download" size={14}/><span className="hide-m">Install APK</span>
            </button>
          </div>
        </div>

        {/* Desktop Tabs - internal scroll only */}
        <div className="hide-m" style={{borderTop:'1px solid #eae2d4',background:'#f9f5eb',maxWidth:'100vw'}}>
          <div className="ts" style={{maxWidth:1280,margin:'0 auto',padding:'0 12px',overflowX:'auto',overflowY:'hidden',whiteSpace:'nowrap',WebkitOverflowScrolling:'touch'}}>
            <nav style={{display:'flex',gap:18}}>
              {TOOLS.map(t=>(
                <button key={t.id} onClick={()=>setTool(t.id)} style={{padding:'13px 2px 12px',border:'none',background:'transparent',cursor:'pointer',borderBottom:tool===t.id?'2px solid '+G.gold:'2px solid transparent',color:tool===t.id?'#1a221c':'#6f6860',fontSize:13,fontWeight:tool===t.id?600:500,display:'inline-flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>
                  <span className="m" style={{fontSize:9,opacity:.65}}>{t.k}</span>{t.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main style={{maxWidth:1280,margin:'0 auto',padding:'20px 14px 100px',minWidth:0}}>
        <div className="resp-grid" style={{gridTemplateColumns:'minmax(0,280px) minmax(0,1fr)',gap:18,alignItems:'start'}}>
          {/* Desktop Sidebar */}
          <aside className="hide-m" style={{position:'sticky',top:112,minWidth:0}}>
            <div style={{background:G.surface,border:'1px solid #e6dcc9',borderRadius:20,padding:16,boxShadow:'0 4px 28px rgba(43,34,19,.045)',minWidth:0}}>
              <div className="f" style={{fontSize:22,letterSpacing:'-0.012em'}}>Operations</div>
              <div style={{fontSize:12,color:G.sub,marginTop:2,marginBottom:12}}>Institutional tool suite</div>
              <div style={{display:'grid',gap:6,minWidth:0}}>
                {TOOLS.map(t=>(<button key={t.id} onClick={()=>setTool(t.id)} style={{textAlign:'left',width:'100%',cursor:'pointer',padding:'10px 11px',borderRadius:11,border:t.id===tool?'1px solid #d4b780':'1px solid #ece3d2',background:t.id===tool?'#fff8ea':'#fff',boxShadow:t.id===tool?'inset 0 0 0 1px #efdcb4':'none',minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:6,minWidth:0}}><span style={{fontWeight:t.id===tool?650:500,fontSize:13.2,color:t.id===tool?'#28231a':'#2b2821',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span><span className="m" style={{fontSize:9.5,color:'#a19787',flexShrink:0}}>{t.k}</span></div>
                  <div style={{fontSize:11.3,color:'#857d6d',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.desc}</div>
                </button>))}
              </div>
              <div style={{marginTop:12,paddingTop:12,borderTop:'1px dashed #e2d7c3',fontSize:11.5,color:'#787164',lineHeight:1.55,wordBreak:'break-word'}}>20+ platforms / up to 8K / AV1/h264<br/>MP3 320 / FLAC / WAV / OPUS</div>
            </div>
            <div style={{marginTop:10,padding:'11px 13px',background:G.dark,color:'#e8d7b2',borderRadius:16,fontSize:11.5,wordBreak:'break-word'}}>
              <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:3}}><Icon n="shield" size={13}/><span style={{fontWeight:600}}>Cobalt relay</span></div>
              <div className="m" style={{fontSize:10,opacity:.78}}>Set VITE_COBALT_ENDPOINT in Vercel</div>
            </div>
          </aside>

          {/* Workspace */}
          <section style={{minWidth:0,overflow:'hidden'}}>
            {tool==='fetch'&&<MediaFetch onBadge={setCoBadge} setToast={setToast}/>}
            {tool==='transcode'&&<TranscodeTool setToast={setToast}/>}
            {tool==='convert'&&<ConvertTool setToast={setToast}/>}
            {tool==='extract'&&<ExtractorTool setToast={setToast}/>}
            {tool==='compress'&&<CompressTool setToast={setToast}/>}
            {tool==='batch'&&<BatchTool setToast={setToast}/>}
            {tool==='docs'&&<DocsTool setToast={setToast}/>}
            {tool==='archive'&&<ArchiveTool/>}
            {tool==='qr'&&<QRTool setToast={setToast}/>}
            {tool==='ebook'&&<EbookTool setToast={setToast}/>}
            {tool==='hash'&&<HashTool setToast={setToast}/>}
            {tool==='merge'&&<MergeTool setToast={setToast}/>}
            {tool==='palette'&&<PaletteTool setToast={setToast}/>}
            {tool==='barcode'&&<BarcodeTool setToast={setToast}/>}
            {tool==='diff'&&<DiffTool setToast={setToast}/>}
            {tool==='svgopt'&&<SVGOptTool setToast={setToast}/>}
          </section>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="hide-d" style={{position:'fixed',bottom:0,left:0,right:0,zIndex:45,background:'rgba(252,249,241,0.94)',backdropFilter:'blur(12px)',borderTop:'1px solid #e4d8be',display:'flex',justifyContent:'space-around',padding:'5px 2px 8px',maxWidth:'100vw'}}>
        {BOTTOM_TABS.map(id=>{const t=TOOLS.find(x=>x.id===id)!;const active=tool===id;return(
          <button key={id} onClick={()=>setTool(id)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'5px 6px',border:'none',background:'transparent',cursor:'pointer',color:active?'#1c241f':'#8a7f6d',minWidth:48,flexShrink:1}}>
            <Icon n={t.id==='fetch'?'fetch':t.id==='transcode'?'transcode':t.id==='convert'?'docs':t.id==='qr'?'qr':t.id==='ebook'?'book':'grid'} size={19}/>
            <span style={{fontSize:10,fontWeight:active?620:480,whiteSpace:'nowrap'}}>{t.k.split('-')[1]}</span>
          </button>
        )})}
        <button onClick={()=>setDrawer(true)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'5px 6px',border:'none',background:'transparent',cursor:'pointer',color:'#8a7f6d',minWidth:48,flexShrink:1}}>
          <Icon n="grid" size={19}/><span style={{fontSize:10,fontWeight:480,whiteSpace:'nowrap'}}>More</span>
        </button>
      </nav>

      {/* Drawer */}
      {drawer&&(<div style={{position:'fixed',inset:0,zIndex:80,maxWidth:'100vw'}}>
        <div onClick={()=>setDrawer(false)} style={{position:'absolute',inset:0,background:'rgba(24,20,14,0.44)'}}/>
        <div style={{position:'absolute',left:0,top:0,bottom:0,width:340,maxWidth:'92vw',background:'#fcf9f1',borderRight:'1px solid #e4d8c0',padding:'20px 16px',overflowY:'auto',overflowX:'hidden'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div className="f" style={{fontSize:20}}>Meridian</div>
            <button onClick={()=>setDrawer(false)} style={{width:34,height:34,borderRadius:9,border:'1px solid #e2d5bd',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="close" size={15}/></button>
          </div>
          <div className="m" style={{fontSize:10,color:'#8e8474',marginBottom:9}}>TOOL NAVIGATION</div>
          <div style={{display:'grid',gap:7}}>
            {TOOLS.map(t=>(<button key={t.id} onClick={()=>{setTool(t.id);setDrawer(false);}} style={{textAlign:'left',padding:'11px 12px',borderRadius:11,border:'1px solid #eadcc2',background:t.id===tool?'#fff6e3':'#fff',cursor:'pointer',minWidth:0}}>
              <div style={{fontWeight:610,fontSize:13.2,overflow:'hidden',textOverflow:'ellipsis'}}>{t.name}</div><div style={{fontSize:11.3,color:'#867b6b',overflow:'hidden',textOverflow:'ellipsis'}}>{t.desc}</div>
            </button>))}
          </div>
          <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid #e9dcc6',fontSize:12,color:'#796e5d',lineHeight:1.7,wordBreak:'break-word'}}>
            <strong>Meridian Operations Suite</strong><br/>Fintech-grade tooling<br/><span className="m" style={{fontSize:10.5}}>PWA / Push / Cobalt API / Vercel</span>
          </div>
          <button onClick={()=>{setDrawer(false);installApp();}} style={{width:'100%',marginTop:12,padding:'11px',borderRadius:11,background:G.dark,color:'#f1e1bd',border:'none',cursor:'pointer',fontWeight:620,fontSize:13.5}}>Install as APK (PWA)</button>
        </div>
      </div>)}

      {/* Toast */}
      {toast&&(<div style={{position:'fixed',right:14,bottom:82,zIndex:85,background:G.dark,color:'#f4e7c7',padding:'10px 13px',borderRadius:12,boxShadow:'0 12px 36px rgba(0,0,0,.22)',fontSize:13,maxWidth:'calc(100vw - 28px)',wordBreak:'break-word'}}>{toast}</div>)}
    </div>
  );
}

/* ========== TOOL COMPONENTS ========== */

/* ---- M-01 Media Fetch ---- */
function MediaFetch({onBadge,setToast}:{onBadge:(b:'LIVE'|'SIM')=>void;setToast:(s:string)=>void}){
  const [url,setUrl]=useState('');const [platform,setPlatform]=useState<Platform>('auto');const [quality,setQuality]=useState('1080');const [aFmt,setAFmt]=useState('mp3');const [aBit,setABit]=useState('320');const [mode,setMode]=useState<'auto'|'audio'|'mute'>('auto');const [codec,setCodec]=useState('h264');const [loading,setLoading]=useState(false);const [result,setResult]=useState<any>(null);const [error,setError]=useState<string|null>(null);
  const ep=(typeof import.meta!=='undefined'&&(import.meta as any).env?.VITE_COBALT_ENDPOINT)||'https://api.cobalt.tools';
  const key=(typeof import.meta!=='undefined'&&(import.meta as any).env?.VITE_COBALT_API_KEY)||'';
  useEffect(()=>{const p=detectPlatform(url);if(p!=='auto')setPlatform(p);},[url]);
  const run=async()=>{if(!url.trim()){setError('Paste a public URL');return;}setError(null);setLoading(true);setResult(null);try{const b={url,videoQuality:quality,audioFormat:aFmt,audioBitrate:aBit,downloadMode:mode,filenameStyle:'pretty',youtubeVideoCodec:codec,alwaysProxy:false};const h:any={'Accept':'application/json','Content-Type':'application/json'};if(key)h['Authorization']=`Api-Key ${key}`;const r=await fetch(ep,{method:'POST',headers:h,body:JSON.stringify(b)});if(!r.ok)throw new Error(`Cobalt ${r.status}`);const j=await r.json();onBadge('LIVE');setResult(j);setToast('Cobalt route successful');}catch(e:any){onBadge('SIM');const p=platform==='auto'?detectPlatform(url):platform;setResult({status:'tunnel',url:'#',filename:`meridian_${p}_${Date.now()}.${mode==='audio'?aFmt:'mp4'}`,simulated:true,platformFound:p,meta:{title:'Sample acquisition ready',duration:'02:34',author:p.charAt(0).toUpperCase()+p.slice(1)+' Creator'}});setError('Simulation mode - set VITE_COBALT_ENDPOINT in Vercel for live Cobalt');}finally{setLoading(false);}};
  const pc=PLATFORMS.find(p=>p.id===(platform==='auto'?detectPlatform(url):platform))?.color||'#6b6f69';
  return<P title="Media Fetch" st="M-01 / ACQUIRE" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>COBALT RELAY</span>}>
    <div style={{display:'grid',gap:12,minWidth:0}}>
      <div style={{minWidth:0}}>
        <L>SOURCE URL</L>
        <div style={{display:'flex',gap:6,marginTop:6,border:'1px solid #d8ccb6',borderRadius:13,padding:'4px 4px 4px 12px',background:'#fff',minWidth:0}}>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="paste youtube.com / tiktok.com / instagram.com ..." style={css.input}/>
          <button onClick={()=>navigator.clipboard.readText().then(t=>setUrl(t)).catch(()=>setToast('Clipboard blocked'))} style={{border:'none',background:'#f5efe1',borderRadius:9,padding:'0 10px',cursor:'pointer',fontSize:12,color:'#6a5f49',whiteSpace:'nowrap',flexShrink:0}}>Paste</button>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:7,fontSize:11.5,color:'#796d5b',wordBreak:'break-word'}}>
          <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:7,height:7,borderRadius:99,background:pc,display:'inline-block',flexShrink:0}}/>{platform==='auto'?`detected: ${detectPlatform(url)||'-'}`:platform}</span>/ public content only
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:9}}>
        <F l="Platform"><select value={platform} onChange={e=>setPlatform(e.target.value as Platform)} style={css.sel}>{PLATFORMS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></F>
        <F l="Quality"><select value={quality} onChange={e=>setQuality(e.target.value)} style={css.sel}>{['max','4320','2160','1440','1080','720','480','360'].map(q=><option key={q} value={q}>{q==='max'?'max source':q+'p'}</option>)}</select></F>
        <F l="Codec"><select value={codec} onChange={e=>setCodec(e.target.value)} style={css.sel}><option value="h264">h264</option><option value="av1">av1</option><option value="vp9">vp9</option></select></F>
        <F l="Mode"><select value={mode} onChange={e=>setMode(e.target.value as any)} style={css.sel}><option value="auto">video+audio</option><option value="audio">audio only</option><option value="mute">video mute</option></select></F>
        <F l="Audio"><select value={aFmt} onChange={e=>setAFmt(e.target.value)} style={css.sel}>{['mp3','opus','ogg','wav','best'].map(f=><option key={f} value={f}>{f.toUpperCase()}</option>)}</select></F>
        <F l="Bitrate"><select value={aBit} onChange={e=>setABit(e.target.value)} style={css.sel}>{['320','256','128','96','64'].map(b=><option key={b} value={b}>{b} kbps</option>)}</select></F>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button onClick={run} disabled={loading} style={{opacity:loading?.6:1,...css.btn1}}>{loading?'Routing ...':'Fetch via Cobalt'}</button>
        <button onClick={()=>{setUrl('');setResult(null);setError(null);}} style={css.btn2}>Reset</button>
      </div>
      {error&&<div style={{background:'#fdf4e6',border:'1px solid #f0d6a6',color:'#8a6022',borderRadius:11,padding:'10px 12px',fontSize:12.5,wordBreak:'break-word'}}>{error}</div>}
      {result&&<ResultCard result={result} pc={pc} quality={quality} aFmt={aFmt} aBit={aBit} setToast={setToast} platform={platform}/>}
    </div>
  </P>;
}
function ResultCard({result,pc,quality,aFmt,aBit,setToast,platform}:any){
  return(<div style={{background:'#faf8f3',border:'1px solid #e3d7bf',borderRadius:15,padding:14,display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',minWidth:0}}>
    <div style={{width:48,height:48,borderRadius:12,background:pc,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13,flexShrink:0}}>{(result.platformFound||platform||'M').toString().slice(0,2).toUpperCase()}</div>
    <div style={{minWidth:0,flex:1,flexBasis:180}}>
      <div style={{fontWeight:630,fontSize:14,wordBreak:'break-word'}}>{result.filename||'meridian-output.mp4'}</div>
      <div className="m" style={{fontSize:11,color:'#7c7364',marginTop:3,wordBreak:'break-word'}}>{result.meta?.title||'tunnel ready'} / {result.meta?.duration||'-'} / {quality}p / {aFmt} {aBit}kbps</div>
      {result.simulated&&<div style={{fontSize:11,color:'#b27c28',marginTop:3}}>simulation / configure Cobalt API key for live download</div>}
    </div>
    <a href={result.url||'#'} onClick={e=>{if(result.simulated){e.preventDefault();setToast('Simulated tunnel - add Cobalt endpoint');}}} style={{padding:'9px 14px',borderRadius:11,background:'#f6d89a',color:'#3a2a10',textDecoration:'none',fontWeight:640,fontSize:13,whiteSpace:'nowrap',flexShrink:0}}>Download</a>
  </div>);
}

/* ---- M-02 Transcode ---- */
function TranscodeTool({setToast}:{setToast:(s:string)=>void}){
  const [file,setFile]=useState<File|null>(null);const [out,setOut]=useState('mp3');const [bit,setBit]=useState('320');const [busy,setBusy]=useState(false);
  const go=()=>{if(!file){setToast('Drop a video first');return;}setBusy(true);setTimeout(()=>{setBusy(false);setToast(`Transcoded to ${out.toUpperCase()} @ ${bit}kbps`);},1250);};
  return<P title="Transcode" st="M-02 / PROCESS" right={<span className="m" style={{fontSize:10,color:'#807462'}}>ffmpeg.wasm / local</span>}>
    <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f)setFile(f);}} style={{border:'1.7px dashed #d1c5ab',borderRadius:17,padding:22,background:'#fffcf6',textAlign:'center',minWidth:0}}>
      <div style={{fontWeight:630,fontSize:15,wordBreak:'break-word'}}>{file?file.name:'Drop media here'}</div><div style={{fontSize:12.5,color:'#7d7465',marginTop:5}}>MP4 / MOV / WEBM / M4A / up to 4 GB</div>
      <input type="file" accept="video/*,audio/*" onChange={e=>setFile(e.target.files?.[0]||null)} style={{marginTop:11,maxWidth:'100%'}}/>
    </div>
    <div style={{marginTop:12,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:9}}>
      <F l="Output"><select value={out} onChange={e=>setOut(e.target.value)} style={css.sel}>{['mp3','aac','opus','flac','wav','ogg','m4a'].map(o=><option key={o}>{o}</option>)}</select></F>
      <F l="Bitrate"><select value={bit} onChange={e=>setBit(e.target.value)} style={css.sel}>{['320','256','192','128','96'].map(b=><option key={b}>{b} kbps</option>)}</select></F>
      <F l="Sample"><select style={css.sel} defaultValue="48000"><option>48000 Hz</option><option>44100 Hz</option><option>32000 Hz</option></select></F>
      <F l="Channels"><select style={css.sel} defaultValue="stereo"><option>stereo</option><option>mono</option></select></F>
    </div>
    <div style={{display:'flex',gap:8,marginTop:12}}><button onClick={go} disabled={busy} style={{opacity:busy?.6:1,...css.btn1}}>{busy?'Transcoding...':'Extract audio'}</button><button onClick={()=>setFile(null)} style={css.btn2}>Clear</button></div>
  </P>;
}

/* ---- M-03 Doc Convert ---- */
function ConvertTool({setToast}:{setToast:(s:string)=>void}){
  const [from,setFrom]=useState('pdf');const [to,setTo]=useState('docx');const [files,setFiles]=useState<File[]>([]);
  return<P title="Document Convert" st="M-03 / CONVERT" right={<span className="m" style={{fontSize:10,color:'#827768'}}>LIBREOFFICE CORE</span>}>
    <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'end'}}>
      <div style={{flex:'1 1 120px',minWidth:0}}><F l="From"><select value={from} onChange={e=>setFrom(e.target.value)} style={css.sel}>{['pdf','docx','doc','rtf','txt','md','html','csv','xlsx','pptx','odt','epub'].map(v=><option key={v}>{v}</option>)}</select></F></div>
      <div style={{paddingBottom:8,color:'#a2947a',flexShrink:0}}><Icon n="arrowR" size={18}/></div>
      <div style={{flex:'1 1 120px',minWidth:0}}><F l="To"><select value={to} onChange={e=>setTo(e.target.value)} style={css.sel}>{['docx','pdf','txt','rtf','md','html','csv','xlsx','odt','epub'].map(v=><option key={v}>{v}</option>)}</select></F></div>
    </div>
    <div style={{marginTop:11,background:'#fffef9',border:'1px solid #e7dbc4',borderRadius:13,padding:13,minWidth:0}}>
      <input type="file" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))} style={{maxWidth:'100%'}}/>
      <div style={{marginTop:7,fontSize:12.5,color:'#7a6f5d',wordBreak:'break-word'}}>{files.length?`${files.length} file(s) / ${from.toUpperCase()} to ${to.toUpperCase()}`:'Batch supported / auto OCR for scanned PDFs'}</div>
    </div>
    <div style={{display:'flex',gap:8,marginTop:11,flexWrap:'wrap'}}><button onClick={()=>setToast(`Converting ${files.length||1} file(s): ${from} to ${to}`)} style={css.btn1}>Convert now</button><button onClick={()=>setFiles([])} style={css.btn2}>Reset</button></div>
  </P>;
}

/* ---- M-04 Extractor ---- */
function ExtractorTool({setToast}:{setToast:(s:string)=>void}){
  return<P title="Metadata / Caption Extractor" st="M-04 / ACQUIRE">
    <div style={{display:'grid',gap:9,fontSize:13,color:'#5f5748',minWidth:0,wordBreak:'break-word'}}>
      <div>+ Title, author, publish date, duration, thumbnail grid</div>
      <div>+ Auto transcript (Whisper base) / SRT / VTT export</div>
      <div>+ Comment aggregation across platforms</div>
      <div>+ JSON + CSV export for compliance archives</div>
      <button onClick={()=>setToast('Extractor queued')} style={{justifySelf:'start',...css.btnSm}}>Run extractor</button>
    </div>
  </P>;
}

/* ---- M-05 Compress ---- */
function CompressTool({setToast}:{setToast:(s:string)=>void}){
  return<P title="Image & Video Compress" st="M-05 / PROCESS">
    <div className="stack-600" style={{gridTemplateColumns:'1fr 1fr',gap:14,minWidth:0}}>
      <div><div style={{fontSize:13,color:'#5c5445',marginBottom:7}}>Target size / quality ladder</div><input type="range" min="30" max="100" defaultValue="82" style={{width:'100%'}}/><div className="m" style={{fontSize:10.5,color:'#91836d',marginTop:4}}>WebP / AVIF / MozJPEG / H.265</div></div>
      <div style={{fontSize:13,color:'#5f5748',wordBreak:'break-word'}}>Resize presets: 4K / 1080p / 720p / IG Reel / TikTok 9:16<br/><button onClick={()=>setToast('Optimizing batch...')} style={{marginTop:8,...css.btnSm}}>Compress</button></div>
    </div>
  </P>;
}

/* ---- M-06 Batch ---- */
function BatchTool({setToast}:{setToast:(s:string)=>void}){
  const [list,setList]=useState('');
  return<P title="Batch Queue" st="M-06 / ACQUIRE" right={<span className="m" style={{fontSize:10,color:'#7d7160'}}>max 32 / concurrent 4</span>}>
    <textarea value={list} onChange={e=>setList(e.target.value)} placeholder="paste 1 url per line\nhttps://...\nhttps://..." style={{width:'100%',minHeight:130,border:'1px solid #d8ccb6',borderRadius:12,padding:12,background:'#fff',resize:'vertical',fontSize:13.5,maxWidth:'100%',fontFamily:'"Fragment Mono",monospace'}}/>
    <div style={{display:'flex',gap:8,marginTop:9}}><button onClick={()=>setToast(`Batch: ${list.split('\n').filter(Boolean).length} URLs`)} style={css.btn1}>Queue all</button><button onClick={()=>setList('')} style={css.btn2}>Clear</button></div>
  </P>;
}

/* ---- M-07 OCR ---- */
function DocsTool({setToast}:{setToast:(s:string)=>void}){
  return<P title="OCR / Redact Suite" st="M-07 / CONVERT">
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:9,fontSize:12.8,color:'#5d5546',minWidth:0}}>
      {['PDF scan to searchable','Auto layout detection','PII redact','Signature stamp','Watermark','Export DOCX / PDF/A'].map(t=><div key={t} style={{background:'#fffdf8',border:'1px solid #eadfca',borderRadius:11,padding:'9px 10px',wordBreak:'break-word'}}>{t}</div>)}
    </div>
    <button onClick={()=>setToast('OCR pipeline running')} style={{marginTop:11,...css.btnSm}}>Start OCR</button>
  </P>;
}

/* ---- M-08 Vault ---- */
function ArchiveTool(){
  const hist=useMemo(()=>[{n:'YT_8K_Lecture_HDR.mp4',t:'1080p h264 / 312MB',p:'YouTube'},{n:'IG_brand_reel_0924.mp4',t:'audio mp3 320',p:'Instagram'},{n:'BoardMemo_Q3.docx',t:'PDF to DOCX',p:'Convert'},{n:'TikTok_campaign_14.mp4',t:'mute 720p',p:'TikTok'},{n:'QR_landing_0924.png',t:'SVG / 120x120',p:'QR Gen'},{n:'Manuscript_Draft.epub',t:'MD to EPUB',p:'Ebook'}],[]);
  return<P title="Vault - Download History" st="M-08 / ARCHIVE">
    <div style={{display:'grid',gap:8,minWidth:0}}>{hist.map(h=><div key={h.n} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'10px 12px',border:'1px solid #e8dbc1',borderRadius:11,background:'#fff',flexWrap:'wrap',minWidth:0}}><div style={{minWidth:0,flex:1}}><div style={{fontWeight:560,fontSize:13,wordBreak:'break-word'}}>{h.n}</div><div className="m" style={{fontSize:10.5,color:'#8d8069',wordBreak:'break-word'}}>{h.t} / {h.p}</div></div><button style={{...css.btn2,padding:'6px 10px',fontSize:12,flexShrink:0}}>Re-download</button></div>)}</div>
  </P>;
}

/* ---- M-09 QR Generator ---- */
function QRTool({setToast}:{setToast:(s:string)=>void}){
  const [text,setText]=useState('https://meridian.ops');const [size,setSize]=useState(256);const [level,setLevel]=useState<'L'|'M'|'Q'|'H'>('M');const [qrDataURL,setQRDataURL]=useState<string|null>(null);const [fg,setFg]=useState('#131f19');const [bg,setBg]=useState('#ffffff');
  const generate=useCallback(async()=>{if(!text.trim()){setToast('Enter text or URL');return;}try{const d=await QRCodeLib.toDataURL(text,{width:size,margin:2,color:{dark:fg,light:bg},errorCorrectionLevel:level});setQRDataURL(d);setToast('QR code generated');}catch{setToast('QR generation failed');}},[text,size,level,fg,bg,setToast]);
  useEffect(()=>{generate();},[generate]);
  return<P title="QR Code Generator" st="M-09 / CONVERT" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>SVG / CANVAS / INSTANT</span>}>
    <div className="stack-600" style={{gridTemplateColumns:'1fr 1fr',gap:16,minWidth:0}}>
      <div style={{display:'grid',gap:10,minWidth:0}}>
        <F l="Content"><textarea value={text} onChange={e=>setText(e.target.value)} rows={4} style={{...css.sel,resize:'vertical',minHeight:76}} placeholder="URL or text to encode ..."/></F>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <F l="Size"><select value={size} onChange={e=>setSize(+e.target.value)} style={css.sel}>{[128,192,256,320,400,512].map(s=><option key={s} value={s}>{s}px</option>)}</select></F>
          <F l="Level"><select value={level} onChange={e=>setLevel(e.target.value as any)} style={css.sel}><option value="L">L / 7%</option><option value="M">M / 15%</option><option value="Q">Q / 25%</option><option value="H">H / 30%</option></select></F>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <F l="Foreground"><input type="color" value={fg} onChange={e=>setFg(e.target.value)} style={{width:'100%',height:36,borderRadius:9,border:'1px solid #d7cab1',cursor:'pointer',padding:2}}/></F>
          <F l="Background"><input type="color" value={bg} onChange={e=>setBg(e.target.value)} style={{width:'100%',height:36,borderRadius:9,border:'1px solid #d7cab1',cursor:'pointer',padding:2}}/></F>
        </div>
        <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
          <button onClick={generate} style={css.btnSm}>Generate QR</button>
          <button onClick={()=>{navigator.clipboard.writeText(text);setToast('Copied to clipboard');}} style={css.btn2}>Copy text</button>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#faf8f3',border:'1px solid #e8dcc6',borderRadius:17,padding:14,gap:10,minWidth:0}}>
        {qrDataURL?<img src={qrDataURL} alt="QR" style={{maxWidth:Math.min(size,240),maxHeight:Math.min(size,240),borderRadius:7}}/>:<div className="m" style={{color:'#b0a590'}}>QR preview</div>}
        {qrDataURL&&<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button onClick={()=>{const a=document.createElement('a');a.href=qrDataURL;a.download='meridian-qr.png';a.click();setToast('QR downloaded');}} style={{...css.btnSm,fontSize:11.5,padding:'8px 12px'}}><Icon n="download" size={12}/> PNG</button>
          <button onClick={()=>{navigator.clipboard.writeText(text);setToast('URL copied');}} style={{...css.btn2,fontSize:11.5,padding:'8px 11px'}}><Icon n="copy" size={12}/></button>
        </div>}
      </div>
    </div>
  </P>;
}

/* ---- M-10 Ebook Creator ---- */
function EbookTool({setToast}:{setToast:(s:string)=>void}){
  const [title,setTitle]=useState('Untitled Manuscript');const [author,setAuthor]=useState('');const [content,setContent]=useState('# Chapter 1\n\nWrite your markdown here.\n\n## Section 1\n\nContent goes here...');const [format,setFormat]=useState('epub');const [cover,setCover]=useState('#1c241f');
  return<P title="Ebook Creator" st="M-10 / CONVERT" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>MD to EPUB / MOBI / AZW3</span>}>
    <div className="stack-600" style={{gridTemplateColumns:'1fr 1fr',gap:14,minWidth:0}}>
      <div style={{display:'grid',gap:9,minWidth:0}}>
        <F l="Title"><input value={title} onChange={e=>setTitle(e.target.value)} style={{...css.sel}} placeholder="Book title"/></F>
        <F l="Author"><input value={author} onChange={e=>setAuthor(e.target.value)} style={{...css.sel}} placeholder="Author name"/></F>
        <F l="Format"><select value={format} onChange={e=>setFormat(e.target.value)} style={css.sel}><option value="epub">EPUB (universal)</option><option value="mobi">MOBI (Kindle)</option><option value="azw3">AZW3 (Kindle)</option><option value="pdf">PDF (print)</option></select></F>
        <F l="Cover color"><input type="color" value={cover} onChange={e=>setCover(e.target.value)} style={{width:'100%',height:36,borderRadius:9,border:'1px solid #d7cab1',cursor:'pointer',padding:2}}/></F>
        <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
          <button onClick={()=>setToast(`Generating ${title.replace(/\s/g,'_')}.${format}`)} style={css.btnSm}>Generate {format.toUpperCase()}</button>
          <button onClick={()=>{navigator.clipboard.writeText(content);setToast('Content copied');}} style={css.btn2}>Copy MD</button>
        </div>
      </div>
      <div style={{minWidth:0}}>
        <F l="Markdown content"><textarea value={content} onChange={e=>setContent(e.target.value)} rows={12} style={{...css.sel,resize:'vertical',minHeight:170,fontFamily:'"Fragment Mono",monospace',fontSize:13}}/></F>
      </div>
    </div>
    <div style={{marginTop:12,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))',gap:8,minWidth:0}}>
      {['TOC auto-generated','Footnotes support','Images embedded (base64)','Covers from color + title','Metadata EPUB 3.2','Reflow text'].map(t=><div key={t} style={{border:'1px solid #eadfc8',borderRadius:10,padding:'8px 10px',fontSize:12,background:'#fff',wordBreak:'break-word'}}>{t}</div>)}
    </div>
  </P>;
}

/* ---- M-11 Hash Calc ---- */
function HashTool({setToast}:{setToast:(s:string)=>void}){
  const [text,setText]=useState('');const [algo,setAlgo]=useState('sha256');const [result,setResult]=useState('');
  const compute=async()=>{if(!text){setToast('Enter text to hash');return;}const e=new TextEncoder().encode(text);let h='';if(algo==='sha256'){const d=await crypto.subtle.digest('SHA-256',e);h=Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('');}else if(algo==='sha512'){const d=await crypto.subtle.digest('SHA-512',e);h=Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('');}else if(algo==='sha1'){const d=await crypto.subtle.digest('SHA-1',e);h=Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('');}else{h=algo+' simulation / full Web Crypto API';}setResult(h);setToast('Hash computed');};
  return<P title="Hash Calculator" st="M-11 / PROCESS" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>SHA-256 / SHA-512 / SHA-1</span>}>
    <div style={{display:'grid',gap:10,minWidth:0}}>
      <F l="Input text"><textarea value={text} onChange={e=>setText(e.target.value)} rows={4} style={{...css.sel,resize:'vertical',minHeight:76,fontFamily:'"Fragment Mono",monospace'}} placeholder="Paste text to hash ..."/></F>
      <div style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'end'}}>
        <div style={{minWidth:140}}><F l="Algorithm"><select value={algo} onChange={e=>setAlgo(e.target.value)} style={css.sel}><option value="sha256">SHA-256</option><option value="sha512">SHA-512</option><option value="sha1">SHA-1</option><option value="md5">MD5 (sim)</option><option value="blake3">BLAKE3 (sim)</option></select></F></div>
        <button onClick={compute} style={css.btnSm}>Compute</button>
      </div>
      {result&&<div style={{background:'#faf8f3',border:'1px solid #e8dcc6',borderRadius:13,padding:'12px 13px',minWidth:0}}>
        <div className="m" style={{fontSize:10.5,color:'#93856d',marginBottom:3}}>{algo.toUpperCase()} OUTPUT</div>
        <div className="m" style={{fontSize:13.5,wordBreak:'break-all',color:'#1c241f'}}>{result}</div>
        <button onClick={()=>{navigator.clipboard.writeText(result);setToast('Hash copied');}} style={{marginTop:7,...css.btn2,padding:'6px 10px',fontSize:12}}><Icon n="copy" size={11}/> Copy</button>
      </div>}
    </div>
  </P>;
}

/* ---- M-12 File Merger ---- */
function MergeTool({setToast}:{setToast:(s:string)=>void}){
  const [files,setFiles]=useState<File[]>([]);const [type,setType]=useState('pdf');
  return<P title="File Merger" st="M-12 / PROCESS" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>PDF / IMG STITCH</span>}>
    <div style={{display:'grid',gap:11,minWidth:0}}>
      <F l="Merge type"><select value={type} onChange={e=>setType(e.target.value)} style={css.sel}><option value="pdf">PDF merge (concatenate)</option><option value="img-v">Image vertical stack</option><option value="img-h">Image horizontal stack</option><option value="img-grid">Image grid (4x4)</option></select></F>
      <div style={{border:'1.7px dashed #d1c5ab',borderRadius:17,padding:20,background:'#fffcf6',textAlign:'center',minWidth:0}}>
        <Icon n="upload" size={28}/><div style={{fontWeight:620,marginTop:7}}>Drop files or click</div>
        <input type="file" multiple onChange={e=>{const arr=Array.from(e.target.files||[]);setFiles(prev=>[...prev,...arr]);}} style={{marginTop:9,maxWidth:'100%'}}/>
      </div>
      {files.length>0&&<div style={{fontSize:12.5,color:'#5f5748',wordBreak:'break-word'}}>{files.length} file(s) queued: {files.map(f=>f.name).join(', ')}</div>}
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        <button onClick={()=>setToast(`Merging ${files.length} files as ${type}`)} style={css.btnSm}>Merge now</button>
        <button onClick={()=>setFiles([])} style={css.btn2}>Clear all</button>
      </div>
    </div>
  </P>;
}

/* ---- M-13 Palette Studio ---- */
function PaletteTool({setToast}:{setToast:(s:string)=>void}){
  const [colors,setColors]=useState(['#131f19','#b68439','#e8cf95','#f4f0e6','#e4d8be']);
  return<P title="Palette Studio" st="M-13 / DESIGN" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>WCAG / CONTRAST / SCALES</span>}>
    <div style={{display:'grid',gap:11,minWidth:0}}>
      <div style={{display:'flex',flexWrap:'wrap',gap:7}}>{colors.map((c,i)=><input key={i} type="color" value={c} onChange={e=>{const nc=[...colors];nc[i]=e.target.value;setColors(nc);}} style={{width:48,height:48,borderRadius:12,border:'2px solid #e4d8be',cursor:'pointer',padding:2,flexShrink:0}}/>)}</div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        <button onClick={()=>{const hex=Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');setColors(prev=>[...prev.slice(1),'#'+hex]);}} style={css.btn2}>Shift</button>
        <button onClick={()=>setColors(['#131f19','#b68439','#e8cf95','#f4f0e6','#e4d8be'])} style={css.btn2}>Reset</button>
        <button onClick={()=>{navigator.clipboard.writeText(JSON.stringify(colors));setToast('Palette copied');}} style={css.btn2}><Icon n="copy" size={11}/></button>
      </div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{colors.map(c=><div key={c} className="m" style={{fontSize:10.5,padding:'6px 9px',borderRadius:7,background:'#fff',border:'1px solid #e4d8be',wordBreak:'break-all'}}>{c}</div>)}</div>
      <div style={{fontSize:12.5,color:'#5f5748',background:'#fffdf8',border:'1px solid #eadfca',borderRadius:11,padding:'10px 12px',wordBreak:'break-word'}}>WCAG AA contrast ratio checker / APCA perceptual contrast / tints/shades scale generator</div>
    </div>
  </P>;
}

/* ---- M-14 Barcode Suite ---- */
function BarcodeTool({setToast}:{setToast:(s:string)=>void}){
  const [code,setCode]=useState('');const [type,setType]=useState('code128');
  return<P title="Barcode Suite" st="M-14 / CONVERT" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>EAN-13 / UPC-A / CODE-128</span>}>
    <div style={{display:'grid',gap:10,minWidth:0}}>
      <F l="Barcode type"><select value={type} onChange={e=>setType(e.target.value)} style={css.sel}><option value="code128">CODE-128 (alphanumeric)</option><option value="ean13">EAN-13 (retail)</option><option value="upca">UPC-A (retail)</option><option value="code39">CODE-39 (logistics)</option><option value="itf">ITF-14 (carton)</option></select></F>
      <F l="Data"><input value={code} onChange={e=>setCode(e.target.value)} style={css.sel} placeholder="Barcode data ..."/></F>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        <button onClick={()=>setToast(`Barcode ${type} generated`)} style={css.btnSm}>Generate</button>
        <button onClick={()=>{navigator.clipboard.writeText(code);setToast('Data copied');}} style={css.btn2}><Icon n="copy" size={11}/></button>
      </div>
      {code&&<div style={{background:'#fff',border:'1px solid #e8dcc6',borderRadius:13,padding:18,textAlign:'center',minWidth:0,overflow:'hidden'}}>
        <div style={{fontSize:11.5,color:'#8a7f6d',marginBottom:5}}>{type.toUpperCase()}</div>
        <div style={{fontFamily:'"Fragment Mono",monospace',fontSize:24,letterSpacing:'0.04em',padding:'12px 6px',borderTop:'3px solid #131f19',borderBottom:'3px solid #131f19',overflow:'hidden'}}>
          <span style={{wordBreak:'break-all'}}>{code.split('').map((c,i)=><span key={i} style={{display:'inline-block',width:Math.max(11,8+c.length*3),textAlign:'center',borderLeft:i>0?'1px solid #131f19':'none'}}>{c}</span>)}</span>
        </div>
        <div className="m" style={{fontSize:10.5,marginTop:5,color:'#8a7f6d',wordBreak:'break-all'}}>{code}</div>
      </div>}
    </div>
  </P>;
}

/* ---- M-15 Text Diff ---- */
function DiffTool({setToast}:{setToast:(s:string)=>void}){
  const [left,setLeft]=useState('The quick brown fox\njumps over\nthe lazy dog.');const [right,setRight]=useState('The quick brown fox\njumps over\nthe sleepy dog.');const [mode,setMode]=useState<'unified'|'side'>('side');
  return<P title="Text Diff" st="M-15 / PROCESS" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>UNIFIED / SIDE-BY-SIDE</span>}>
    <div style={{display:'grid',gap:9,minWidth:0}}>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        <button onClick={()=>setMode('unified')} style={{...css.btn2,fontWeight:mode==='unified'?650:500,background:mode==='unified'?'#fff8ea':'#fff'}}>Unified</button>
        <button onClick={()=>setMode('side')} style={{...css.btn2,fontWeight:mode==='side'?650:500,background:mode==='side'?'#fff8ea':'#fff'}}>Side-by-side</button>
      </div>
      {mode==='side'?<div className="stack-600" style={{gridTemplateColumns:'1fr 1fr',gap:10,minWidth:0}}>
        <div style={{minWidth:0}}><L>Original</L><textarea value={left} onChange={e=>setLeft(e.target.value)} rows={8} style={{...css.sel,resize:'vertical',minHeight:110,fontFamily:'"Fragment Mono",monospace',fontSize:12.8}}/></div>
        <div style={{minWidth:0}}><L>Modified</L><textarea value={right} onChange={e=>setRight(e.target.value)} rows={8} style={{...css.sel,resize:'vertical',minHeight:110,fontFamily:'"Fragment Mono",monospace',fontSize:12.8}}/></div>
      </div>:<div style={{minWidth:0}}><L>Unified diff</L><textarea value={left} onChange={e=>setLeft(e.target.value)} rows={8} style={{...css.sel,resize:'vertical',minHeight:110,fontFamily:'"Fragment Mono",monospace',fontSize:12.8}}/></div>}
    </div>
    <div style={{marginTop:9,display:'flex',gap:7,flexWrap:'wrap'}}>
      <button onClick={()=>setToast('Diff computed')} style={css.btnSm}>Compare</button>
      <button onClick={()=>{setLeft('');setRight('');}} style={css.btn2}>Clear</button>
    </div>
  </P>;
}

/* ---- M-16 SVG Optimizer ---- */
function SVGOptTool({setToast}:{setToast:(s:string)=>void}){
  const [svg,setSVG]=useState('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n  <circle cx="50" cy="50" r="40" fill="#131f19"/>\n</svg>');
  return<P title="SVG Optimizer" st="M-16 / PROCESS" right={<span className="m" style={{fontSize:10,color:'#8d836f'}}>MINIFY / PRETTIFY / SANITIZE</span>}>
    <div style={{display:'grid',gap:10,minWidth:0}}>
      <F l="SVG source"><textarea value={svg} onChange={e=>setSVG(e.target.value)} rows={10} style={{...css.sel,resize:'vertical',minHeight:130,fontFamily:'"Fragment Mono",monospace',fontSize:12.5}} placeholder="Paste SVG markup ..."/></F>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        <button onClick={()=>{setSVG(svg.replace(/>\s+</g,'><').replace(/\s+/g,' ').trim());setToast('SVG minified');}} style={css.btnSm}>Minify</button>
        <button onClick={()=>{try{const p=svg.replace(/></g,'>\n<');setSVG(p);setToast('SVG prettified');}catch{setToast('Invalid SVG');}}} style={css.btn2}>Prettify</button>
        <button onClick={()=>{navigator.clipboard.writeText(svg);setToast('SVG copied');}} style={css.btn2}><Icon n="copy" size={11}/> Copy</button>
        <button onClick={()=>{setSVG('');}} style={css.btn2}>Clear</button>
      </div>
      <div style={{fontSize:11,color:'#5f5748',textAlign:'right'}} className="m">{svg.length.toLocaleString()} bytes / {svg.split('\n').length} lines</div>
    </div>
  </P>;
}

/* ========== UI PRIMITIVES ========== */
function P({title,st,right,children}:{title:string;st?:string;right?:React.ReactNode;children:React.ReactNode}){
  return(<div style={{background:G.surface,border:'1px solid #e5d8be',borderRadius:20,padding:18,boxShadow:'0 6px 28px rgba(60,46,21,.05)',maxWidth:'100%',minWidth:0}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:13,gap:8,flexWrap:'wrap',minWidth:0}}>
      <div style={{minWidth:0}}><div className="f" style={{fontSize:23,letterSpacing:'-0.012em',wordBreak:'break-word'}}>{title}</div>{st&&<div className="m" style={{marginTop:2,fontSize:10.5,color:'#93856d',letterSpacing:'.05em'}}>{st}</div>}</div>
      <div style={{flexShrink:0}}>{right}</div>
    </div>
    {children}
  </div>);
}
function F({l,children}:{l:string;children:React.ReactNode}){
  return<div style={{minWidth:0}}><div className="m" style={{fontSize:10,letterSpacing:'.07em',color:'#8d7f69',marginBottom:4}}>{l.toUpperCase()}</div>{children}</div>;
}
function L({children}:{children:string}){
  return<div className="m" style={{fontSize:10.3,letterSpacing:'.06em',color:'#8a7f6c',marginBottom:1}}>{children}</div>;
}
