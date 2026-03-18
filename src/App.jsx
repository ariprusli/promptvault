import { useState, useEffect, useCallback, useMemo } from "react";

const PRESET_MODELS = [
  "claude-opus-4-6","claude-sonnet-4-6","claude-haiku-4-5-20251001",
  "gpt-4o","gpt-4o-mini","gpt-4-turbo",
  "gemini-1.5-pro","gemini-1.5-flash",
  "llama-3.1-70b","mistral-large",
];
const DEFAULT_STATUSES = ["draft","active","deprecated"];
const DEFAULT_LINK_TYPES = ["docs","testing","reference","playground","other"];
const STATUS_CFG = {
  draft:      { label:"Draft",      dot:"#f5a623", glow:"rgba(245,166,35,.35)"  },
  active:     { label:"Active",     dot:"#4ade80", glow:"rgba(74,222,128,.35)"  },
  deprecated: { label:"Deprecated", dot:"#f87171", glow:"rgba(248,113,113,.35)" },
};
const LINK_COLORS = { docs:"#60a5fa",testing:"#4ade80",reference:"#fbbf24",playground:"#c084fc",other:"#94a3b8" };
const getLinkColor = t => LINK_COLORS[t] || "#94a3b8";
const uid = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36);

function autoGroupKey(p) { if(p.promptType) return p.promptType; return "ungrouped"; }
function autoGroupLabel(key) {
  if(key==="ungrouped") return "Ungrouped";
  if(key==="creative")  return "🎨 Creative";
  if(key==="caption")   return "✍️ Caption";
  return key;
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

function normLine(s) {
  return s.replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
    .replace(/\u00a0/g,' ').replace(/\u200b/g,'').replace(/\r/g,'').trimEnd();
}

function wordDiff(a, b) {
  const aw = a.split(/(\s+)/), bw = b.split(/(\s+)/), m = aw.length, n = bw.length;
  const dp = Array.from({length:m+1}, () => new Array(n+1).fill(0));
  for(let i=m-1;i>=0;i--) for(let j=n-1;j>=0;j--)
    dp[i][j] = aw[i]===bw[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j],dp[i][j+1]);
  const out=[];let i=0,j=0;
  while(i<m||j<n){
    if(i<m&&j<n&&aw[i]===bw[j]){out.push({t:"eq",w:aw[i]});i++;j++;}
    else if(j<n&&(i>=m||dp[i][j+1]>=dp[i+1][j])){out.push({t:"add",w:bw[j]});j++;}
    else{out.push({t:"del",w:aw[i]});i++;}
  }
  return out;
}

function diffLines(a, b) {
  const al=a.split("\n"),bl=b.split("\n"),m=al.length,n=bl.length;
  const an=al.map(normLine),bn=bl.map(normLine);
  const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=m-1;i>=0;i--) for(let j=n-1;j>=0;j--)
    dp[i][j]=an[i]===bn[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const out=[];let i=0,j=0;
  while(i<m||j<n){
    if(i<m&&j<n&&an[i]===bn[j]){out.push({t:"eq",line:al[i],oi:i+1,ni:j+1});i++;j++;}
    else if(j<n&&(i>=m||dp[i][j+1]>=dp[i+1][j])){out.push({t:"add",line:bl[j],n:j+1});j++;}
    else{out.push({t:"del",line:al[i],n:i+1});i++;}
  }
  const paired=[];
  for(let k=0;k<out.length;k++){
    if(out[k].t==="del"&&k+1<out.length&&out[k+1].t==="add"){
      const words=wordDiff(normLine(out[k].line),normLine(out[k+1].line));
      const hasChange=words.some(w=>w.t!=="eq");
      if(!hasChange){paired.push({t:"eq",line:out[k].line,oi:out[k].n,ni:out[k+1].n});}
      else{paired.push({t:"chg",del:out[k],add:out[k+1],words});}
      k++;
    } else { paired.push(out[k]); }
  }
  return paired;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg0:#03060f;--bg1:#080d1a;--bg2:#0c1322;--bg3:#111928;
  --border:rgba(99,130,200,.11);--border-hi:rgba(99,130,200,.26);
  --accent:#3b7eff;--accent2:#00d4ff;--ag:rgba(59,126,255,.18);
  --text:#e2e8f8;--text2:#7888aa;--text3:#3d4a62;
  --gold:#f5c842;--font:'Inter',sans-serif;--mono:'JetBrains Mono',monospace;--sb:250px;
}
[data-theme="light"]{
  --bg0:#f5f7fa;--bg1:#ffffff;--bg2:#f0f2f6;--bg3:#e4e7ef;
  --border:rgba(100,116,139,.18);--border-hi:rgba(37,99,235,.4);
  --accent:#2563eb;--accent2:#0891b2;--ag:rgba(37,99,235,.12);
  --text:#0f172a;--text2:#334155;--text3:#64748b;
  --gold:#b45309;
}
body,#root{background:var(--bg0);color:var(--text);font-family:var(--font);height:100vh;overflow:hidden;transition:background .2s,color .2s;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--bg3);border-radius:2px;}
input,textarea,select,button{font-family:var(--font);}
input::placeholder,textarea::placeholder{color:var(--text3);}
select option{background:var(--bg2);color:var(--text);}
.app{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:var(--sb);min-width:var(--sb);display:flex;flex-direction:column;border-right:1px solid var(--border);overflow:hidden;background:var(--bg1);}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;position:relative;background:var(--bg0);}
.sb-item{padding:9px 11px;border-radius:10px;cursor:pointer;transition:all .14s;border:1px solid transparent;margin-bottom:2px;}
.sb-item:hover{background:var(--bg3);border-color:var(--border);}
.sb-item.sel{background:rgba(59,126,255,.09);border-color:rgba(59,126,255,.3);}
[data-theme="light"] .sb-item.sel{background:rgba(37,99,235,.07);border-color:rgba(37,99,235,.28);}
.btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all .14s;border:none;outline:none;white-space:nowrap;flex-shrink:0;}
.bp{background:var(--accent);color:#fff;}.bp:hover{filter:brightness(1.08);}
.bg{background:var(--bg3);color:var(--text2);border:1px solid var(--border);}.bg:hover{border-color:var(--border-hi);color:var(--text);}
.bd{background:rgba(248,113,113,.09);color:#f87171;border:1px solid rgba(248,113,113,.18);}
[data-theme="light"] .bd{background:rgba(220,38,38,.07);color:#dc2626;border-color:rgba(220,38,38,.2);}
.bgo{background:rgba(245,200,66,.09);color:var(--gold);border:1px solid rgba(245,200,66,.2);}
[data-theme="light"] .bgo{background:rgba(180,83,9,.07);border-color:rgba(180,83,9,.22);}
.inp{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:7px 11px;color:var(--text);font-size:13px;outline:none;width:100%;transition:border .14s,background .2s;}
.inp:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(59,126,255,.08);}
[data-theme="light"] .inp{background:#fff;border-color:rgba(100,116,139,.22);}
[data-theme="light"] .inp:focus{border-color:var(--accent);}
.vtab{padding:5px 11px;border-radius:7px;font-size:11px;font-weight:500;cursor:pointer;background:transparent;border:1px solid transparent;color:var(--text3);white-space:nowrap;font-family:var(--mono);transition:all .14s;}
.vtab:hover{background:var(--bg3);color:var(--text2);}
.vtab.va{background:rgba(59,126,255,.09);border-color:rgba(59,126,255,.32);color:var(--accent);}
[data-theme="light"] .vtab.va{background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.3);}
.tag-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;background:var(--bg3);color:var(--text2);border:1px solid var(--border);cursor:pointer;transition:all .14s;}
.tag-pill:hover{background:rgba(248,113,113,.09);color:#f87171;}
[data-theme="light"] .tag-pill{background:rgba(100,116,139,.1);}
[data-theme="light"] .tag-pill:hover{background:rgba(220,38,38,.07);color:#dc2626;}
.section-label{font-size:10px;color:var(--text3);letter-spacing:.1em;font-family:var(--mono);font-weight:600;}
.prompt-area{flex:1;background:var(--bg0);border:none;color:var(--text);padding:20px 24px;font-size:14px;line-height:2;resize:none;outline:none;font-family:var(--mono);min-height:0;transition:background .2s,color .2s;}
[data-theme="light"] .prompt-area{background:#fafbfc;color:#1e293b;}
.panel{background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-top:10px;}
.panel-hd{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;}
.diff-add{background:rgba(74,222,128,.055);border-left:2px solid #4ade80;}
.diff-del{background:rgba(248,113,113,.055);border-left:2px solid #f87171;}
.diff-eq{border-left:2px solid transparent;}
[data-theme="light"] .diff-add{background:rgba(22,163,74,.07);border-left-color:#16a34a;}
[data-theme="light"] .diff-del{background:rgba(220,38,38,.07);border-left-color:#dc2626;}
.modal-bg{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999;}
[data-theme="light"] .modal-bg{background:rgba(0,0,0,.25);}
.modal-box{background:var(--bg1);border:1px solid var(--border-hi);border-radius:16px;padding:26px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.25);}
[data-theme="light"] .modal-box{box-shadow:0 20px 60px rgba(0,0,0,.12);}
.ver-bar{background:rgba(8,13,26,.6);}
[data-theme="light"] .ver-bar{background:rgba(240,242,246,.95);}
.meta-bar{background:rgba(3,6,15,.5);}
[data-theme="light"] .meta-bar{background:rgba(248,250,252,.9);}
.editor-hd,.editor-notes{background:var(--bg1);}
.group-hd{display:flex;align-items:center;gap:6px;padding:4px 6px;margin-bottom:3px;}
@keyframes fu{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
@keyframes pd{0%,100%{opacity:1;}50%{opacity:.3;}}
.fade-up{animation:fu .2s ease forwards;}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InlineDiff({ words, side }) {
  return (
    <span style={{whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
      {side==="left" ? "− " : "+ "}
      {words.map((w,i) => {
        if(w.t==="eq") return <span key={i}>{w.w}</span>;
        if(side==="left"&&w.t==="del") return <span key={i} style={{background:"rgba(248,113,113,.32)",borderRadius:3,padding:"1px 2px"}}>{w.w}</span>;
        if(side==="right"&&w.t==="add") return <span key={i} style={{background:"rgba(74,222,128,.28)",borderRadius:3,padding:"1px 2px"}}>{w.w}</span>;
        return null;
      })}
    </span>
  );
}

function useLS(key, def) {
  const [val, setV] = useState(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
  });
  const set = useCallback(v => {
    setV(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key]);
  return [val, set];
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [data, setData]       = useLS("pv4", { prompts:[], globalLinks:[] });
  const [selId, setSelId]     = useState(null);
  const [view, setView]       = useState("editor");
  const [diffPair, setDiffPair] = useState([null,null]);
  const [search, setSearch]   = useState("");
  const [fTag, setFTag]       = useState("");
  const [fStatus, setFStatus] = useState("");
  const [toast, setToast]     = useState(null);
  const [tab, setTab]         = useState("prompts");

  const prefersDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const [theme, setTheme] = useLS("pv-theme", prefersDark ? "dark" : "light");

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  const notify = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null), 2500); };
  const persist = useCallback(d => setData(d), [setData]);

  const sel      = useMemo(() => data.prompts.find(p => p.id === selId), [data, selId]);
  const allTags  = useMemo(() => { const s=new Set(); data.prompts.forEach(p=>(p.tags||[]).forEach(t=>s.add(t))); return [...s]; }, [data]);
  const filtered = useMemo(() => data.prompts.filter(p => {
    const q = search.toLowerCase();
    return (!q||p.name.toLowerCase().includes(q)||(p.description||"").toLowerCase().includes(q)||(p.tags||[]).some(t=>t.includes(q)))
      && (!fTag||(p.tags||[]).includes(fTag))
      && (!fStatus||p.status===fStatus);
  }), [data, search, fTag, fStatus]);

  const newPrompt = () => {
    const p = {
      id:uid(), name:"Untitled Prompt", description:"", tags:[], links:[],
      status:"draft", promptType:"creative", formats:[],
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
      versions:[{ id:uid(), versionNumber:1, label:"v1.0", model:"claude-sonnet-4-6", content:"", notes:"", createdAt:new Date().toISOString() }]
    };
    persist({ ...data, prompts:[p,...data.prompts] });
    setSelId(p.id); setView("editor");
  };

  const upd    = (id,u) => persist({ ...data, prompts: data.prompts.map(p => p.id===id ? {...p,...u,updatedAt:new Date().toISOString()} : p) });
  const del    = (id)   => { persist({ ...data, prompts: data.prompts.filter(p=>p.id!==id) }); if(selId===id) setSelId(null); notify("Prompt deleted"); };
  const addVer = (pid)  => {
    const p = data.prompts.find(x=>x.id===pid), last = p.versions[p.versions.length-1];
    const v = { id:uid(), versionNumber:last.versionNumber+1, label:`v${last.versionNumber+1}.0`, model:last.model, content:last.content, notes:"", createdAt:new Date().toISOString() };
    upd(pid, { versions:[...p.versions,v] }); notify("New version created"); return v.id;
  };
  const delVer = (pid,vid) => {
    const p = data.prompts.find(x=>x.id===pid);
    if(p.versions.length<=1){ notify("Can't delete only version","err"); return; }
    upd(pid, { versions: p.versions.filter(v=>v.id!==vid) }); notify("Version deleted");
  };
  const updVer  = (pid,vid,u) => { const p=data.prompts.find(x=>x.id===pid); upd(pid, { versions: p.versions.map(v=>v.id===vid?{...v,...u}:v) }); };
  const dup     = (id) => {
    const src = data.prompts.find(p=>p.id===id); if(!src) return;
    const nid = uid();
    const p = { ...JSON.parse(JSON.stringify(src)), id:nid, name:`Copy of ${src.name}`,
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
      versions: src.versions.map(v=>({...v,id:uid()})),
      links: (src.links||[]).map(l=>({...l,id:uid()})) };
    persist({ ...data, prompts:[p,...data.prompts] });
    setSelId(nid); setView("editor"); notify("Duplicated");
  };
  const setGroup = (id,group) => persist({ ...data, prompts: data.prompts.map(p=>p.id===id?{...p,group:group||undefined,updatedAt:new Date().toISOString()}:p) });
  const addGL    = (l) => persist({ ...data, globalLinks:[...(data.globalLinks||[]),{...l,id:uid(),createdAt:new Date().toISOString()}] });
  const delGL    = (id) => persist({ ...data, globalLinks:(data.globalLinks||[]).filter(l=>l.id!==id) });

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="sidebar">
          {/* Logo + theme toggle */}
          <div style={{padding:"14px 16px 10px",borderBottom:"1px solid var(--border)",flexShrink:0,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:"var(--mono)",fontWeight:800,fontSize:16}}>
                <span style={{color:"var(--accent)"}}>prompt</span><span style={{color:"var(--accent2)"}}>vault</span>
              </div>
              <div style={{fontSize:9,color:"var(--text3)",marginTop:1,letterSpacing:".12em",fontFamily:"var(--mono)"}}>DOCUMENTATION MANAGER</div>
            </div>
            <button onClick={toggleTheme} title="Toggle theme"
              style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,cursor:"pointer",padding:"5px 8px",fontSize:14,lineHeight:1,flexShrink:0,color:"var(--text2)"}}>
              {theme==="dark" ? "☀️" : "🌙"}
            </button>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            {[["prompts","Prompts"],["groups","Groups"],["links","Links"],["diff","Diff"]].map(([t,l]) => (
              <button key={t} onClick={()=>setTab(t)}
                style={{flex:1,padding:"7px 2px",fontSize:9,fontFamily:"var(--mono)",fontWeight:600,background:"transparent",border:"none",cursor:"pointer",
                  color:tab===t?"var(--accent2)":"var(--text3)",borderBottom:tab===t?"2px solid var(--accent2)":"2px solid transparent",marginBottom:-1,transition:"color .14s"}}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {tab==="prompts" && <PromptsTab prompts={filtered} allCount={data.prompts.length} selId={selId} search={search} setSearch={setSearch} fTag={fTag} setFTag={setFTag} fStatus={fStatus} setFStatus={setFStatus} allTags={allTags} onSel={id=>{setSelId(id);setView("editor");}} onDup={dup}/>}
          {tab==="groups"  && <GroupsTab allPrompts={data.prompts} selId={selId} onSel={id=>{setSelId(id);setView("editor");}} onSetGroup={setGroup} onDup={dup}/>}
          {tab==="links"   && <GlobalLinksTab links={data.globalLinks||[]} onAdd={addGL} onDel={delGL}/>}
          {tab==="diff"    && <DiffTab allPrompts={data.prompts} onOpen={(pid,a,b)=>{setSelId(pid);setDiffPair([a,b]);setView("diff");}}/>}

          <div style={{padding:"10px 12px",borderTop:"1px solid var(--border)",flexShrink:0}}>
            <button className="btn bp" onClick={newPrompt} style={{width:"100%",justifyContent:"center",padding:"8px",fontSize:13,fontWeight:600}}>+ New Prompt</button>
          </div>
        </div>

        <div className="main">
          {!sel
            ? <EmptyState onNew={newPrompt} count={data.prompts.length}/>
            : view==="diff"
              ? <DiffView prompt={sel} pair={diffPair} setPair={setDiffPair} onBack={()=>setView("editor")}/>
              : <EditorView key={sel.id} prompt={sel} onUpd={upd} onUpdVer={updVer} onAddVer={addVer} onDelVer={delVer} onDel={del} onDup={dup} onDiff={(a,b)=>{setDiffPair([a,b]);setView("diff");}} notify={notify}/>}
          {toast && (
            <div style={{position:"absolute",bottom:24,right:24,zIndex:9999,
              background:toast.type==="err"?"rgba(248,113,113,.12)":"rgba(74,222,128,.1)",
              border:`1px solid ${toast.type==="err"?"rgba(248,113,113,.3)":"rgba(74,222,128,.25)"}`,
              color:toast.type==="err"?"#f87171":"#4ade80",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:500}}>
              {toast.msg}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Sidebar tabs ─────────────────────────────────────────────────────────────

function PromptsTab({ prompts, allCount, selId, search, setSearch, fTag, setFTag, fStatus, setFStatus, allTags, onSel, onDup }) {
  const [hov, setHov] = useState(null);
  return (
    <>
      <div style={{padding:"10px 12px 6px",flexShrink:0}}>
        <div style={{position:"relative"}}>
          <svg style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"var(--text3)"}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="inp" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:28,fontSize:12}}/>
        </div>
      </div>
      <div style={{padding:"0 12px 8px",display:"flex",gap:5,flexShrink:0}}>
        <select className="inp" value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{flex:1,fontSize:11,padding:"4px 6px",cursor:"pointer"}}>
          <option value="">All status</option>
          {DEFAULT_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select className="inp" value={fTag} onChange={e=>setFTag(e.target.value)} style={{flex:1,fontSize:11,padding:"4px 6px",cursor:"pointer"}}>
          <option value="">All tags</option>
          {allTags.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"2px 8px"}}>
        {prompts.length===0
          ? <div style={{color:"var(--text3)",fontSize:12,textAlign:"center",padding:"32px 0"}}>{allCount===0?"No prompts yet":"No results"}</div>
          : prompts.map(p => (
            <div key={p.id} style={{position:"relative"}} onMouseEnter={()=>setHov(p.id)} onMouseLeave={()=>setHov(null)}>
              <div className={`sb-item ${p.id===selId?"sel":""}`} onClick={()=>onSel(p.id)} style={{paddingRight:30}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                  <span style={{width:6,height:6,borderRadius:"50%",flexShrink:0,background:STATUS_CFG[p.status]?.dot,
                    boxShadow:`0 0 6px ${STATUS_CFG[p.status]?.glow}`,animation:p.status==="active"?"pd 2s ease infinite":"none",display:"inline-block"}}/>
                  <span style={{flex:1,fontSize:12,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                  <span style={{fontSize:9,color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>v{p.versions.length}</span>
                </div>
                {(p.tags||[]).length>0 && (
                  <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                    {p.tags.slice(0,3).map(t=><span key={t} style={{fontSize:9,color:"var(--text3)",background:"var(--bg3)",padding:"1px 5px",borderRadius:20,border:"1px solid var(--border)"}}>#{t}</span>)}
                    {p.tags.length>3 && <span style={{fontSize:9,color:"var(--text3)"}}>+{p.tags.length-3}</span>}
                  </div>
                )}
              </div>
              {hov===p.id && (
                <button onClick={e=>{e.stopPropagation();onDup(p.id);}}
                  style={{position:"absolute",top:"50%",right:6,transform:"translateY(-50%)",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:6,color:"var(--text2)",cursor:"pointer",padding:"3px 5px",fontSize:11,lineHeight:1,zIndex:2}}>⧉</button>
              )}
            </div>
          ))}
      </div>
    </>
  );
}

function GroupsTab({ allPrompts, selId, onSel, onSetGroup, onDup }) {
  const [editId,  setEditId]  = useState(null);
  const [editVal, setEditVal] = useState("");

  const groups = useMemo(() => {
    const map = {};
    allPrompts.forEach(p => {
      const key   = p.group || autoGroupKey(p);
      const label = p.group || autoGroupLabel(key);
      if(!map[key]) map[key] = { key, label, prompts:[] };
      map[key].prompts.push(p);
    });
    return Object.values(map).sort((a,b) => a.label.localeCompare(b.label));
  }, [allPrompts]);

  return (
    <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
      {groups.length===0 && <div style={{color:"var(--text3)",fontSize:12,textAlign:"center",padding:"32px 0"}}>No prompts yet</div>}
      {groups.map(g => (
        <div key={g.key} style={{marginBottom:10}}>
          <div className="group-hd">
            {editId===g.key ? (
              <input autoFocus className="inp" value={editVal}
                onChange={e=>setEditVal(e.target.value)}
                onKeyDown={e=>{
                  if(e.key==="Enter"){ g.prompts.forEach(p=>onSetGroup(p.id,editVal.trim()||null)); setEditId(null); }
                  if(e.key==="Escape") setEditId(null);
                }}
                onBlur={()=>setEditId(null)}
                style={{fontSize:11,padding:"2px 7px",flex:1,fontFamily:"var(--mono)"}}/>
            ) : (
              <>
                <span style={{fontSize:11,fontWeight:700,color:"var(--text2)",fontFamily:"var(--mono)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.label}</span>
                <span style={{fontSize:9,color:"var(--text3)",background:"var(--bg3)",padding:"1px 6px",borderRadius:10,border:"1px solid var(--border)",flexShrink:0}}>{g.prompts.length}</span>
                <button onClick={()=>{setEditId(g.key);setEditVal(g.label);}} title="Rename group"
                  style={{background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:11,padding:"0 2px",lineHeight:1,flexShrink:0}}>✎</button>
              </>
            )}
          </div>
          {g.prompts.map(p => (
            <div key={p.id} className={`sb-item ${p.id===selId?"sel":""}`} onClick={()=>onSel(p.id)}
              style={{marginLeft:10,paddingRight:30,display:"flex",alignItems:"center",gap:7,position:"relative"}}>
              <span style={{width:5,height:5,borderRadius:"50%",flexShrink:0,background:STATUS_CFG[p.status]?.dot,display:"inline-block"}}/>
              <span style={{flex:1,fontSize:11,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
              <button onClick={e=>{e.stopPropagation();onDup(p.id);}} title="Duplicate"
                style={{background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:12,padding:"0 2px",lineHeight:1,flexShrink:0,opacity:.5,position:"absolute",right:6}}>⧉</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DiffTab({ allPrompts, onOpen }) {
  const [pid, setPid] = useState(""); const [vA, setVA] = useState(""); const [vB, setVB] = useState("");
  const p = allPrompts.find(x=>x.id===pid); const vs = p?.versions||[];
  useEffect(()=>{
    if(vs.length>=2){ setVA(vs[vs.length-2].id); setVB(vs[vs.length-1].id); }
    else if(vs.length===1){ setVA(vs[0].id); setVB(vs[0].id); }
    else { setVA(""); setVB(""); }
  },[pid]);
  const can = p&&vA&&vB&&vA!==vB;
  return (
    <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:8}}>
      <div className="section-label" style={{marginBottom:4}}>COMPARE VERSIONS</div>
      <select className="inp" value={pid} onChange={e=>setPid(e.target.value)} style={{fontSize:11,padding:"5px 8px",cursor:"pointer"}}>
        <option value="">Select prompt…</option>
        {allPrompts.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {p && <>
        <div>
          <div style={{fontSize:10,color:"#f87171",marginBottom:4}}>Before</div>
          <select className="inp" value={vA} onChange={e=>setVA(e.target.value)} style={{fontSize:11,padding:"5px 8px",cursor:"pointer",color:"#f87171"}}>{vs.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select>
        </div>
        <div>
          <div style={{fontSize:10,color:"#4ade80",marginBottom:4}}>After</div>
          <select className="inp" value={vB} onChange={e=>setVB(e.target.value)} style={{fontSize:11,padding:"5px 8px",cursor:"pointer",color:"#4ade80"}}>{vs.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select>
        </div>
        <button className="btn bgo" onClick={()=>can&&onOpen(p.id,vA,vB)} style={{justifyContent:"center",opacity:can?1:.45,cursor:can?"pointer":"default"}}>⟺ Open Diff</button>
      </>}
      {allPrompts.length===0 && <div style={{color:"var(--text3)",fontSize:12,textAlign:"center",padding:"20px 0"}}>No prompts yet</div>}
    </div>
  );
}

function GlobalLinksTab({ links, onAdd, onDel }) {
  const [form, setForm] = useState({ label:"", url:"", type:"docs" });
  const add = () => {
    if(!form.label.trim()||!form.url.trim()) return;
    let url = form.url.trim();
    if(!/^https?:\/\//i.test(url)) url = "https://" + url;
    onAdd({ label:form.label.trim(), url, type:form.type });
    setForm({ label:"", url:"", type:"docs" });
  };
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
        <div className="section-label">ADD GLOBAL LINK</div>
        <select className="inp" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{fontSize:11,padding:"5px 7px",cursor:"pointer",color:getLinkColor(form.type)}}>{DEFAULT_LINK_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
        <input className="inp" placeholder="Label" value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&add()} style={{fontSize:12,padding:"5px 9px"}}/>
        <input className="inp" placeholder="https://…" value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&add()} style={{fontSize:12,padding:"5px 9px"}}/>
        <button className="btn" onClick={add} style={{background:"rgba(59,126,255,.1)",color:"var(--accent)",border:"1px solid rgba(59,126,255,.25)",fontSize:12,justifyContent:"center"}}>+ Add Link</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
        {links.length===0 && <div style={{color:"var(--text3)",fontSize:12,textAlign:"center",padding:"24px 12px"}}>No global links yet</div>}
        {links.map(lk => (
          <div key={lk.id} style={{padding:"8px 12px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:"var(--bg3)",color:getLinkColor(lk.type),border:"1px solid var(--border)",flexShrink:0,fontFamily:"var(--mono)"}}>{lk.type}</span>
            <a href={lk.url} target="_blank" rel="noopener noreferrer" style={{flex:1,textDecoration:"none",minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lk.label}</div>
              <div style={{fontSize:10,color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>↗ {lk.url}</div>
            </a>
            <button className="btn bd" onClick={()=>onDel(lk.id)} style={{fontSize:10,padding:"3px 7px",flexShrink:0}}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew, count }) {
  return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:18,padding:24}}>
      <div style={{width:72,height:72,borderRadius:18,background:"rgba(59,126,255,.06)",border:"1px solid rgba(59,126,255,.13)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity=".7">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
      </div>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"var(--mono)",fontWeight:700,fontSize:17,marginBottom:6,color:"var(--text)"}}>{count===0?"Start documenting":"Select a prompt"}</div>
        <div style={{color:"var(--text2)",fontSize:13}}>{count===0?"Create your first prompt to get started":`${count} prompt${count!==1?"s":""} in your vault`}</div>
      </div>
      {count===0 && <button className="btn bp" onClick={onNew}>+ Create First Prompt</button>}
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function EditorView({ prompt, onUpd, onUpdVer, onAddVer, onDelVer, onDel, onDup, onDiff, notify }) {
  const [avid,  setAvid]  = useState(prompt.versions[prompt.versions.length-1].id);
  const [tagIn, setTagIn] = useState("");
  const [delM,  setDelM]  = useState(false);
  const [delVM, setDelVM] = useState(null);
  const [showL, setShowL] = useState(false);
  const [lf,    setLf]    = useState({ label:"", url:"", type:"docs" });

  const av     = prompt.versions.find(v=>v.id===avid) || prompt.versions[prompt.versions.length-1];
  const links  = prompt.links || [];
  const tokens = Math.round((av?.content?.length||0) / 4);

  const addTag   = e => { if(e.key==="Enter"&&tagIn.trim()){ const t=tagIn.trim().toLowerCase().replace(/\s+/g,"-"); if(!(prompt.tags||[]).includes(t)) onUpd(prompt.id,{tags:[...(prompt.tags||[]),t]}); setTagIn(""); } };
  const doAddVer = () => { const vid=onAddVer(prompt.id); setTimeout(()=>setAvid(vid),60); };
  const doDelVer = vid => { setDelVM(null); const rem=prompt.versions.filter(v=>v.id!==vid); if(rem.length>0) setAvid(rem[rem.length-1].id); onDelVer(prompt.id,vid); };
  const addLink  = () => {
    if(!lf.label.trim()||!lf.url.trim()) return;
    let url = lf.url.trim(); if(!/^https?:\/\//i.test(url)) url = "https://"+url;
    onUpd(prompt.id,{links:[...links,{id:uid(),label:lf.label.trim(),url,type:lf.type,createdAt:new Date().toISOString()}]});
    setLf({label:"",url:"",type:"docs"}); notify("Link added");
  };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}} className="fade-up">
      {/* Header */}
      <div className="editor-hd" style={{padding:"14px 20px 12px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <input value={prompt.name} onChange={e=>onUpd(prompt.id,{name:e.target.value})}
            style={{flex:1,background:"transparent",border:"none",outline:"none",color:"var(--text)",fontSize:18,fontWeight:700,fontFamily:"var(--mono)",minWidth:0}}/>
          <select value={prompt.status} onChange={e=>onUpd(prompt.id,{status:e.target.value})} className="inp"
            style={{width:"auto",fontSize:11,padding:"3px 8px",cursor:"pointer",color:STATUS_CFG[prompt.status]?.dot,fontWeight:600,fontFamily:"var(--mono)"}}>
            {DEFAULT_STATUSES.map(s=><option key={s} value={s}>{STATUS_CFG[s]?.label||s}</option>)}
          </select>
          <div style={{display:"flex",gap:5,flexShrink:0}}>
            <button className="btn bg" onClick={()=>{try{navigator.clipboard.writeText(av?.content||"");}catch(e){}notify("Copied");}} style={{fontSize:11,padding:"5px 10px"}}>Copy</button>
            <button className="btn bg" onClick={()=>setShowL(s=>!s)} style={{fontSize:11,padding:"5px 10px",borderColor:showL?"var(--accent)":"",color:showL?"var(--accent)":""}}>
              Links{links.length>0&&<span style={{background:"rgba(59,126,255,.15)",color:"var(--accent)",borderRadius:10,padding:"0 5px",fontSize:9,marginLeft:3}}>{links.length}</span>}
            </button>
            <button className="btn bg" onClick={()=>onDup(prompt.id)} style={{fontSize:11,padding:"5px 9px"}}>Dup</button>
            <button className="btn bd" onClick={()=>setDelM(true)} style={{fontSize:11,padding:"5px 9px"}}>Del</button>
          </div>
        </div>
        <input placeholder="Short description…" value={prompt.description||""} onChange={e=>onUpd(prompt.id,{description:e.target.value})}
          style={{width:"100%",background:"transparent",border:"none",outline:"none",color:"var(--text2)",fontSize:12,marginBottom:8}}/>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"center"}}>
          {(prompt.tags||[]).map(t=><span key={t} className="tag-pill" onClick={()=>onUpd(prompt.id,{tags:(prompt.tags||[]).filter(x=>x!==t)})}>#{t} <span style={{opacity:.5}}>×</span></span>)}
          <input placeholder="add tag ↵" value={tagIn} onChange={e=>setTagIn(e.target.value)} onKeyDown={addTag}
            style={{background:"transparent",border:"none",outline:"none",color:"var(--text3)",fontSize:11,width:90}}/>
        </div>
        {showL && (
          <div className="panel">
            <div className="panel-hd"><span className="section-label">LINKS</span></div>
            <div style={{padding:"9px 13px",borderBottom:"1px solid var(--border)",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              <select className="inp" value={lf.type} onChange={e=>setLf(f=>({...f,type:e.target.value}))} style={{fontSize:11,padding:"5px 7px",color:LINK_COLORS[lf.type],width:100,cursor:"pointer"}}>{DEFAULT_LINK_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
              <input className="inp" placeholder="Label" value={lf.label} onChange={e=>setLf(f=>({...f,label:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addLink()} style={{width:110,fontSize:12,padding:"5px 9px"}}/>
              <input className="inp" placeholder="https://…" value={lf.url} onChange={e=>setLf(f=>({...f,url:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addLink()} style={{flex:1,minWidth:120,fontSize:12,padding:"5px 9px"}}/>
              <button className="btn" onClick={addLink} style={{background:"rgba(59,126,255,.1)",color:"var(--accent)",border:"1px solid rgba(59,126,255,.25)",fontSize:12,padding:"5px 12px"}}>+ Add</button>
            </div>
            {links.length===0
              ? <div style={{padding:"12px 14px",color:"var(--text3)",fontSize:12}}>No links yet</div>
              : links.map(lk=>(
                <div key={lk.id} style={{padding:"8px 13px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:9,padding:"2px 8px",borderRadius:20,background:"var(--bg3)",color:LINK_COLORS[lk.type]||"#94a3b8",border:"1px solid var(--border)",flexShrink:0,fontFamily:"var(--mono)"}}>{lk.type}</span>
                  <a href={lk.url} target="_blank" rel="noopener noreferrer" style={{flex:1,display:"flex",alignItems:"center",gap:8,textDecoration:"none",minWidth:0}}>
                    <span style={{fontWeight:600,fontSize:12,color:"var(--text)",whiteSpace:"nowrap",flexShrink:0}}>{lk.label}</span>
                    <span style={{fontSize:10,color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>↗ {lk.url}</span>
                  </a>
                  <button className="btn bd" onClick={()=>onUpd(prompt.id,{links:links.filter(l=>l.id!==lk.id)})} style={{fontSize:10,padding:"3px 8px"}}>×</button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Version tabs */}
      <div className="ver-bar" style={{padding:"8px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:5,overflowX:"auto",flexShrink:0}}>
        {prompt.versions.map(v => (
          <div key={v.id} style={{display:"flex",alignItems:"center",gap:1,flexShrink:0}}>
            <button className={`vtab ${v.id===avid?"va":""}`} onClick={()=>setAvid(v.id)}>{v.label}</button>
            {prompt.versions.length>1 && (
              <button onClick={()=>setDelVM(v.id)}
                style={{background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer",padding:"2px 4px",fontSize:13,lineHeight:1,opacity:.4}}
                onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=.4}>×</button>
            )}
          </div>
        ))}
        <button className="btn bg" onClick={doAddVer} style={{fontSize:11,padding:"5px 10px",marginLeft:4,flexShrink:0}}>+ Version</button>
        {prompt.versions.length>=2 && (
          <button className="btn bgo" onClick={()=>{const vs=prompt.versions;onDiff(vs[vs.length-2].id,vs[vs.length-1].id);}} style={{fontSize:11,padding:"5px 10px",flexShrink:0}}>⟺ Diff</button>
        )}
      </div>

      {/* Version meta */}
      {av && (
        <div className="meta-bar" style={{padding:"8px 20px",borderBottom:"1px solid var(--border)",display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span className="section-label">Label</span>
            <input className="inp" value={av.label} onChange={e=>onUpdVer(prompt.id,av.id,{label:e.target.value})} style={{width:64,fontSize:11,padding:"3px 7px",fontFamily:"var(--mono)"}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7,flex:1,minWidth:0}}>
            <span className="section-label" style={{flexShrink:0}}>Model</span>
            <select className="inp" value={av.model} onChange={e=>onUpdVer(prompt.id,av.id,{model:e.target.value})}
              style={{fontSize:11,padding:"3px 7px",color:"var(--accent2)",cursor:"pointer",fontFamily:"var(--mono)",flex:1,minWidth:0}}>
              {PRESET_MODELS.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <span style={{fontSize:10,color:"var(--accent)",fontFamily:"var(--mono)",background:"rgba(59,126,255,.08)",padding:"2px 8px",borderRadius:5,border:"1px solid rgba(59,126,255,.15)"}}>~{tokens}t</span>
        </div>
      )}

      {/* Prompt textarea */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0}}>
        <div style={{padding:"7px 20px",background:"var(--bg0)",borderBottom:"1px solid var(--border)",flexShrink:0}}><span className="section-label">PROMPT</span></div>
        <textarea className="prompt-area" placeholder={"Write your prompt here…\n\nTip: Use {{variable}} for placeholders"}
          value={av?.content||""} onChange={e=>onUpdVer(prompt.id,av?.id,{content:e.target.value})}/>
      </div>

      {/* Notes */}
      <div className="editor-notes" style={{borderTop:"1px solid var(--border)",padding:"8px 20px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <span className="section-label" style={{flexShrink:0}}>NOTES</span>
        <input placeholder="Version notes…" value={av?.notes||""} onChange={e=>onUpdVer(prompt.id,av?.id,{notes:e.target.value})}
          style={{flex:1,background:"transparent",border:"none",outline:"none",color:"var(--text2)",fontSize:12,minWidth:0}}/>
      </div>

      {/* Delete prompt modal */}
      {delM && (
        <div className="modal-bg" onClick={()=>setDelM(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"var(--mono)",fontWeight:700,fontSize:16,marginBottom:8,color:"var(--text)"}}>Delete prompt?</div>
            <div style={{color:"var(--text2)",fontSize:13,marginBottom:20,lineHeight:1.6}}>Delete <strong style={{color:"var(--text)"}}>{prompt.name}</strong> and all {prompt.versions.length} version{prompt.versions.length!==1?"s":""}?</div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setDelM(false)}>Cancel</button>
              <button className="btn bd" style={{flex:1,justifyContent:"center",fontWeight:700}} onClick={()=>{onDel(prompt.id);setDelM(false);}}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete version modal */}
      {delVM && (
        <div className="modal-bg" onClick={()=>setDelVM(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"var(--mono)",fontWeight:700,fontSize:16,marginBottom:8,color:"var(--text)"}}>Delete version?</div>
            <div style={{color:"var(--text2)",fontSize:13,marginBottom:20,lineHeight:1.6}}>Delete <strong style={{color:"var(--text)"}}>{prompt.versions.find(v=>v.id===delVM)?.label}</strong>?</div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn bg" style={{flex:1,justifyContent:"center"}} onClick={()=>setDelVM(null)}>Cancel</button>
              <button className="btn bd" style={{flex:1,justifyContent:"center",fontWeight:700}} onClick={()=>doDelVer(delVM)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Diff view ────────────────────────────────────────────────────────────────

function DiffView({ prompt, pair, setPair, onBack }) {
  const [a,b] = pair;
  const va = prompt.versions.find(v=>v.id===a) || prompt.versions[0];
  const vb = prompt.versions.find(v=>v.id===b) || prompt.versions[1] || prompt.versions[0];
  const diff    = useMemo(() => diffLines(va?.content||"", vb?.content||""), [va,vb]);
  const added   = diff.filter(d=>d.t==="add"||d.t==="chg").length;
  const removed = diff.filter(d=>d.t==="del"||d.t==="chg").length;

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}} className="fade-up">
      <div className="editor-hd" style={{padding:"12px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",flexShrink:0}}>
        <button className="btn bg" onClick={onBack} style={{fontSize:11}}>← Back</button>
        <span style={{fontFamily:"var(--mono)",fontWeight:700,fontSize:14,color:"var(--text)"}}>Diff — {prompt.name}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <select className="inp" value={a} onChange={e=>setPair([e.target.value,b])} style={{fontSize:11,padding:"4px 8px",color:"#f87171",cursor:"pointer",fontFamily:"var(--mono)"}}>{prompt.versions.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select>
          <span style={{color:"var(--text3)"}}>→</span>
          <select className="inp" value={b} onChange={e=>setPair([a,e.target.value])} style={{fontSize:11,padding:"4px 8px",color:"#4ade80",cursor:"pointer",fontFamily:"var(--mono)"}}>{prompt.versions.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,fontFamily:"var(--mono)",fontSize:12}}>
          <span style={{color:"#4ade80",background:"rgba(74,222,128,.08)",padding:"2px 9px",borderRadius:6,border:"1px solid rgba(74,222,128,.2)"}}>+{added}</span>
          <span style={{color:"#f87171",background:"rgba(248,113,113,.08)",padding:"2px 9px",borderRadius:6,border:"1px solid rgba(248,113,113,.2)"}}>−{removed}</span>
        </div>
      </div>
      <div style={{flex:1,overflow:"hidden",display:"flex",minHeight:0}}>
        <DiffPane diff={diff} side="left"  version={va}/>
        <div style={{width:1,background:"var(--border)",flexShrink:0}}/>
        <DiffPane diff={diff} side="right" version={vb}/>
      </div>
      {diff.filter(d=>d.t!=="eq").length===0 && (
        <div style={{flexShrink:0,borderTop:"1px solid var(--border)",background:"var(--bg2)",padding:"14px 20px"}}>
          <span style={{fontSize:11,color:"var(--text3)"}}>✓ No differences — prompts are identical</span>
        </div>
      )}
    </div>
  );
}

function DiffPane({ diff, side, version }) {
  return (
    <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",minWidth:0}}>
      <div style={{padding:"7px 16px",background:"var(--bg2)",borderBottom:"1px solid var(--border)",fontSize:10,fontFamily:"var(--mono)",fontWeight:600,color:side==="left"?"#f87171":"#4ade80",letterSpacing:".06em",position:"sticky",top:0,zIndex:1,flexShrink:0}}>
        {version?.label} {side==="left"?"(before)":"(after)"}
      </div>
      <div style={{padding:"8px 0",fontSize:12,lineHeight:1.7,fontFamily:"var(--mono)"}}>
        {diff.map((d,i) => {
          if(d.t==="add") { if(side==="left") return null; return <div key={i} className="diff-add" style={{display:"flex",gap:10,padding:"1px 16px",color:"#4ade80"}}><span style={{color:"var(--text3)",userSelect:"none",width:26,flexShrink:0,textAlign:"right",fontSize:10}}>{d.n}</span><span style={{whiteSpace:"pre-wrap",wordBreak:"break-all"}}>+ {d.line}</span></div>; }
          if(d.t==="del") { if(side==="right") return null; return <div key={i} className="diff-del" style={{display:"flex",gap:10,padding:"1px 16px",color:"#f87171"}}><span style={{color:"var(--text3)",userSelect:"none",width:26,flexShrink:0,textAlign:"right",fontSize:10}}>{d.n}</span><span style={{whiteSpace:"pre-wrap",wordBreak:"break-all"}}>− {d.line}</span></div>; }
          if(d.t==="chg") { const ln=side==="left"?d.del.n:d.add.n; return <div key={i} className={side==="left"?"diff-del":"diff-add"} style={{display:"flex",gap:10,padding:"1px 16px",color:side==="left"?"#f87171":"#4ade80"}}><span style={{color:"var(--text3)",userSelect:"none",width:26,flexShrink:0,textAlign:"right",fontSize:10}}>{ln}</span><InlineDiff words={d.words} side={side}/></div>; }
          return <div key={i} className="diff-eq" style={{display:"flex",gap:10,padding:"1px 16px",color:"var(--text2)"}}><span style={{color:"var(--text3)",userSelect:"none",width:26,flexShrink:0,textAlign:"right",fontSize:10}}>{side==="left"?d.oi:d.ni}</span><span style={{whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{"  "}{d.line}</span></div>;
        })}
      </div>
    </div>
  );
}
