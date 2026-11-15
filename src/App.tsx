import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import agentSource from './assets/nexapulse_compute_agent.py?raw';
import {
  Activity, AlertCircle, ArrowDownToLine, ArrowRight, Bell, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Cloud, Code2, Eye, EyeOff,
  Cpu, Database, File as FileIcon, FileArchive, FileCode2, FileImage, FileJson, Folder,
  FolderOpen, Gauge, HardDrive, LayoutDashboard, LockKeyhole, LogIn, LogOut,
  Menu, MoreHorizontal, Network, Plus, RefreshCw, Search, Server, Settings,
  ShieldCheck, Sparkles, UploadCloud, X
} from 'lucide-react';

type Tab = 'dashboard' | 'models' | 'compute' | 'workspace' | 'analytics' | 'settings' | 'docs';
type ProjectFile = { path: string; content: string; binary: boolean; size: number };
type Enrollment = {
  id: string; name: string; provider: string; endpoint_url: string; model_id: string;
  capabilities?: string[]; status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at?: string; expires_at?: string; last_seen_at?: string;
};
type EventItem = { id: string; title: string; detail: string; time: string; kind: 'success'|'info'|'warning' };

const API_BASE = (import.meta.env.VITE_COMPUTE_API_URL || 'https://nexapulse-compute.blacknick517.workers.dev').replace(/\/$/, '');
const cleanEnv = (value?: string) => (value || '').trim().replace(/^['"]|['"]$/g, '');
const SUPABASE_URL = cleanEnv(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '');
const SUPABASE_PUBLIC_KEY = cleanEnv(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
);
const DB_NAME = 'nexapulse-compute-ui';
const DB_STORE = 'workspace';

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function dbGet<T>(key: string): Promise<T | undefined> {
  const db = await openWorkspaceDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result as T | undefined); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
async function dbSet(key: string, value: unknown): Promise<void> {
  const db = await openWorkspaceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function IconMark() { return <span className="brand-mark"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 29 13 10l7 16 7-13 8 16"/><path d="M4 20h9l4-6 6 12 5-7h8"/></svg></span>; }
function StatusDot({state}:{state:'online'|'offline'|'pending'|'unknown'}) { return <i className={`status-dot ${state}`} />; }
function PageTitle({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action?:ReactNode}) { return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action&&<div className="page-title-action">{action}</div>}</div>; }
function StatCard({icon:Icon,label,value,foot,tone}:{icon:typeof Cpu;label:string;value:string;foot:string;tone:string}) { return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={19}/></span><div className="stat-copy"><small>{label}</small><strong>{value}</strong><span>{foot}</span></div></article>; }
function EmptyState({icon:Icon,title,detail,action}:{icon:typeof Folder;title:string;detail:string;action?:ReactNode}) { return <div className="empty-state"><span><Icon size={24}/></span><b>{title}</b><p>{detail}</p>{action}</div>; }
function formatDate(value?:string) { if(!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); }
function buildIsolatedPreview(html:string, files:ProjectFile[]):string {
  let result=html;
  const byName=(path:string)=>files.find(f=>!f.binary&&(f.path===path||f.path.endsWith('/'+path)||f.path.split('/').pop()===path));
  result=result.replace(/<link\b([^>]*?)href=["']([^"']+\.css(?:\?[^"']*)?)["']([^>]*)>/gi,(tag,_a,href)=>{
    const asset=byName(String(href).split('?')[0].replace(/^\.\//,''));
    return asset?`<style>\n${asset.content}\n</style>`:tag;
  });
  result=result.replace(/<script\b([^>]*?)src=["']([^"']+\.js(?:\?[^"']*)?)["']([^>]*)><\/script>/gi,(tag,before,src,after)=>{
    const asset=byName(String(src).split('?')[0].replace(/^\.\//,''));
    return asset?`<script${before}${after}>\n${asset.content}\n<\/script>`:tag;
  });
  for(const asset of files.filter(f=>f.binary)){
    const ext=asset.path.split('.').pop()?.toLowerCase()||'';
    const mime:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',woff:'font/woff',woff2:'font/woff2'};
    if(!mime[ext])continue;
    const data=`data:${mime[ext]};base64,${asset.content}`;
    const escaped=asset.path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    result=result.replace(new RegExp(`(["'])\\.?/?(?:[^"']*/)?${escaped}(["'])`,'g'),`$1${data}$2`);
  }
  return result;
}

function ProjectWorkspace({onEvent}:{onEvent:(title:string,detail:string,kind?:EventItem['kind'])=>void}) {
  const [files,setFiles] = useState<ProjectFile[]>([]);
  const [active,setActive] = useState('');
  const [code,setCode] = useState('');
  const [savedCode,setSavedCode] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('Import a ZIP project or reopen your last workspace.');
  const [preview,setPreview] = useState(false);
  const [filter,setFilter] = useState('');
  const [projectName,setProjectName] = useState('');
  const [restored,setRestored] = useState(false);
  const [draftRestored,setDraftRestored] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = files.find(f=>f.path===active);
  const dirty = !!current && !current.binary && code !== savedCode;
  const visibleFiles = useMemo(()=>files.filter(f=>f.path.toLowerCase().includes(filter.toLowerCase())),[files,filter]);
  const htmlFile = files.find(f=>f.path.toLowerCase().endsWith('.html')&&!f.binary);

  useEffect(()=>{ let live=true; Promise.all([dbGet<{files:ProjectFile[];active:string;projectName:string}>('project'),dbGet<{active:string;code:string}>('editor-draft')]).then(([v,draft])=>{ if(live&&v){setFiles(v.files||[]);setProjectName(v.projectName||'');const activePath=draft?.active||v.active||'';setActive(activePath);const f=(v.files||[]).find(x=>x.path===activePath);if(f&&!f.binary){setSavedCode(f.content);setCode(draft?.active===activePath?draft.code:f.content);}setMessage('Restored your last browser workspace and editor draft from this device.');} }).catch(()=>setMessage('Browser storage is unavailable; this workspace will remain temporary.')).finally(()=>{if(live){setRestored(true);setDraftRestored(true);}}); return ()=>{live=false;}; },[]);
  useEffect(()=>{ if(!restored)return; const t=window.setTimeout(()=>dbSet('project',{files,active,projectName}).then(()=>{}).catch(()=>setMessage('Could not persist this project in browser storage.')),250); return ()=>window.clearTimeout(t); },[files,active,projectName,restored]);
  useEffect(()=>{if(!draftRestored)return;const t=window.setTimeout(()=>dbSet('editor-draft',{active,code}).catch(()=>{}),180);return()=>window.clearTimeout(t);},[active,code,draftRestored]);
  useEffect(()=>{ const handler=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler); },[dirty]);

  function chooseFile(file:ProjectFile){ if(dirty&&!window.confirm('Discard the unsaved editor changes?'))return;setActive(file.path);setCode(file.content);setSavedCode(file.content);setPreview(false); }
  async function importZip(file?:File){ if(!file)return;setBusy(true);setMessage('Reading project archive…');try{if(file.size>40*1024*1024)throw new Error('Please keep ZIP imports under 40 MB for browser stability.');const zip=await JSZip.loadAsync(file);const entries=Object.values(zip.files).filter(f=>!f.dir&&!f.name.startsWith('__MACOSX/')&&!f.name.split('/').some(x=>['node_modules','.git','dist'].includes(x)));if(entries.length>700)throw new Error('This archive contains more than 700 files. Please reduce it before importing.');const loaded:ProjectFile[]=[];for(const entry of entries){const ext=entry.name.split('.').pop()?.toLowerCase()||'';const textual=/^(tsx?|jsx?|mjs|cjs|css|html|json|md|svg|ya?ml|txt|toml|xml|sh|py|sql|env|gitignore|lock)$/.test(ext)||entry.name.endsWith('.env.example');const content=textual?await entry.async('string'):await entry.async('base64');loaded.push({path:entry.name,content,binary:!textual,size:content.length});}loaded.sort((a,b)=>a.path.localeCompare(b.path));const first=loaded.find(f=>/\.(tsx?|jsx?|html|css|json|md)$/.test(f.path)&&!f.binary)||loaded[0];setFiles(loaded);setProjectName(file.name.replace(/\.zip$/i,''));setActive(first?.path||'');setCode(first&&!first.binary?first.content:'');setSavedCode(first&&!first.binary?first.content:'');setMessage(`${loaded.length} files imported locally. Source is isolated in this browser workspace.`);setPreview(false);onEvent('Project imported',`${file.name} · ${loaded.length} files`,'success');}catch(e){setMessage(e instanceof Error?e.message:'Could not read this ZIP.');}finally{setBusy(false);if(inputRef.current)inputRef.current.value='';} }
  function saveEdit(){if(!current)return;const next=files.map(f=>f.path===active?{...f,content:code}:f);setFiles(next);setSavedCode(code);setMessage(`Saved ${active} to this device.`);onEvent('Project file saved',active,'info');}
  async function exportZip(){const zip=new JSZip();for(const f of files){const value=f.path===active&&!f.binary?code:f.content;if(f.binary){zip.file(f.path,value,{base64:true});}else zip.file(f.path,value);}const blob=await zip.generateAsync({type:'blob'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${projectName||'nexapulse-project'}-updated.zip`;a.click();URL.revokeObjectURL(url);setMessage('Exported the updated project ZIP.');}
  const fileIcon=(path:string)=>{const ext=path.split('.').pop()?.toLowerCase();if(['png','jpg','jpeg','webp','gif','svg'].includes(ext||''))return FileImage;if(ext==='json')return FileJson;if(['ts','tsx','js','jsx','css','html','py'].includes(ext||''))return FileCode2;return FileIcon;};
  return <section className="page">
    <PageTitle eyebrow="PROJECTS · SOURCE WORKSPACE" title="Your project workspace" subtitle="Import a frontend, inspect its source, make edits and export the updated project." action={<button className="button primary" onClick={()=>inputRef.current?.click()}><UploadCloud size={16}/> Import ZIP</button>}/>
    <input ref={inputRef} hidden type="file" accept=".zip,application/zip" onChange={e=>importZip(e.target.files?.[0])}/>
    <div className="project-toolbar"><div className="project-ident"><span className="project-logo"><Code2 size={20}/></span><div><b>{projectName||'No project open'}</b><small>{files.length?`${files.length} files · stored on this device`:'ZIP import · source editor · local persistence'}</small></div></div><div className="toolbar-actions"><button className="button secondary" disabled={!files.length} onClick={exportZip}><ArrowDownToLine size={15}/> Export ZIP</button><button className="button secondary" onClick={()=>{if(dirty&&!window.confirm('Discard unsaved edits?'))return;setFiles([]);setActive('');setCode('');setSavedCode('');setProjectName('');setMessage('Workspace cleared from this view.');dbSet('project',{files:[],active:'',projectName:''});dbSet('editor-draft',{active:'',code:''});}} disabled={!files.length}>Close project</button></div></div>
    <div className="editor-layout"><aside className="explorer"><div className="explorer-head"><span><FolderOpen size={14}/> FILE EXPLORER</span><small>{files.length}</small></div><div className="explorer-search"><Search size={13}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Find a file"/></div><div className="file-list">{visibleFiles.length?visibleFiles.map(f=>{const I=fileIcon(f.path);return <button key={f.path} className={`file-row ${active===f.path?'selected':''}`} onClick={()=>chooseFile(f)} title={f.path}><I size={14}/><span>{f.path}</span>{active===f.path&&dirty&&<i className="dirty-dot"/>}</button>}):<div className="file-empty">{files.length?'No matching files.':'Your project files will appear here.'}</div>}</div></aside>
      <div className="code-area"><div className="editor-head"><div className="editor-path"><FileCode2 size={14}/><span>{active||'SOURCE EDITOR'}</span>{dirty&&<em>UNSAVED</em>}</div><div className="editor-actions"><button className="button tiny" disabled={!current||current.binary} onClick={()=>setPreview(v=>!v)}>{preview?'Show source':'Preview info'}</button><button className="button tiny primary" disabled={!dirty} onClick={saveEdit}>Save edit</button></div></div>
        {preview&&current&&!current.binary&&current.path.toLowerCase().endsWith('.html')?<iframe className="project-preview" title="Imported frontend preview" sandbox="allow-scripts" srcDoc={buildIsolatedPreview(code,files)}/>:preview?<div className="preview-info"><span><LockKeyhole size={25}/></span><b>Choose an HTML entry file to preview</b><p>{htmlFile?`Detected HTML entry point: ${htmlFile.path}. Open that file to preview it in an isolated sandbox.`:'No HTML entry point was found. Import a ZIP containing an HTML entry file, or use the source editor for React/Vite files.'} React/Vite projects can be imported and edited here; running a full project requires its build output or a separate isolated build runner.</p></div>:current&&!current.binary?<textarea className="source-editor" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveEdit();}}} />:<div className="preview-info"><span><FileArchive size={25}/></span><b>{current? 'Binary asset selected':'Start with a project ZIP'}</b><p>{current?'This file is retained in the archive but is not editable as text.':'Import a ZIP to open its folder contents and source files.'}</p><button className="button secondary" onClick={()=>inputRef.current?.click()}><UploadCloud size={15}/> Import project</button></div>}</div></div>
    <div className="workspace-status"><span><StatusDot state="online"/>{message}</span><span><ShieldCheck size={13}/> Local source workspace · isolated preview</span></div>

  </section>;
}

function ComputePage({token,onToken,onSignOut,onEvent}:{token:string;onToken:(v:string)=>void;onSignOut:()=>void;onEvent:(title:string,detail:string,kind?:EventItem['kind'])=>void}) {
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [showPassword,setShowPassword]=useState(false);const [authMode,setAuthMode]=useState<'signin'|'signup'>('signin');const [authMessage,setAuthMessage]=useState('');const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [enrollments,setEnrollments]=useState<Enrollment[]>([]);const [loaded,setLoaded]=useState(false);const [actionId,setActionId]=useState('');
  const pending=enrollments.filter(n=>n.status==='pending');
  async function authenticate(e:FormEvent){
    e.preventDefault();
    if(!SUPABASE_URL || !SUPABASE_PUBLIC_KEY){
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Cloudflare Pages, then redeploy.');
      return;
    }
    try {
      const parsedUrl = new URL(SUPABASE_URL);
      if(parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')){
        throw new Error('The Supabase URL must be the HTTPS project URL ending in .supabase.co.');
      }
    } catch(e) {
      setError(e instanceof Error ? e.message : 'VITE_SUPABASE_URL is not a valid project URL.');
      return;
    }
    if(!/^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]+)$/.test(SUPABASE_PUBLIC_KEY)){
      setError('The Supabase public key format is not recognised. Use the project publishable key (sb_publishable_…) or legacy anon key (eyJ…). Do not use the service-role key.');
      return;
    }
    setLoading(true);setError('');setAuthMessage('');
    try{
      const signup=authMode==='signup';
      const endpoint=signup?`${SUPABASE_URL}/auth/v1/signup`:`${SUPABASE_URL}/auth/v1/token?grant_type=password`;
      const r=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLIC_KEY},
        body:JSON.stringify({email:email.trim(),password})
      });
      const raw=await r.text();
      let d:any={};
      try{d=raw?JSON.parse(raw):{};}catch{d={message:raw||'Supabase returned an unreadable response.'};}
      if(!r.ok){
        const detail=d.msg||d.message||d.error_description||d.error||`HTTP ${r.status}`;
        if(/invalid api key/i.test(String(detail))){
          throw new Error('Supabase rejected this public key. Confirm that VITE_SUPABASE_URL and the publishable key belong to the same Supabase project, then redeploy the latest Production build.');
        }
        throw new Error(`${detail} (HTTP ${r.status})`);
      }
      if(signup&&!d.access_token){
        setAuthMessage('Account created. Check your email to confirm the address, then return here to sign in.');
      }else if(d.access_token){
        onToken(d.access_token);setPassword('');setAuthMessage(signup?'Account created and signed in.':'');
      }else{
        setAuthMessage('Request completed. Check your email for the next step.');
      }
    }catch(e){setError(e instanceof Error?e.message:'Authentication failed.');}
    finally{setLoading(false);}
  }
  async function loadEnrollments(){if(!token)return;setLoading(true);setError('');try{const r=await fetch(`${API_BASE}/v1/enrollments`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||d.message||`Request failed (${r.status})`);const rows=Array.isArray(d)?d:(d.enrollments||d.nodes||[]);setEnrollments(rows);setLoaded(true);}catch(e){setError(e instanceof Error?e.message:'Could not load node enrollments.');}finally{setLoading(false);}}
  async function decide(id:string,decision:'approve'|'reject'){setActionId(id);setError('');try{const r=await fetch(`${API_BASE}/v1/enrollments/${id}/${decision}`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||d.message||`${decision} failed (${r.status})`);setEnrollments(old=>old.map(n=>n.id===id?{...n,status:decision==='approve'?'approved':'rejected'}:n));onEvent(decision==='approve'?'Node approved':'Enrollment rejected',id,decision==='approve'?'success':'warning');}catch(e){setError(e instanceof Error?e.message:'Could not update enrollment.');}finally{setActionId('');}}
  useEffect(()=>{if(token)loadEnrollments();},[token]);
  return <section className="page"><PageTitle eyebrow="COMPUTE · NOTEBOOK NODES" title="Compute connections" subtitle="Enroll temporary Kaggle or Colab runtimes and approve them before they join your workspace." action={<button className="button secondary" onClick={loadEnrollments} disabled={!token||loading}><RefreshCw size={15} className={loading?'spin':''}/> Refresh list</button>}/>

    {!token?<div className="auth-card"><div className="auth-icon"><LockKeyhole size={22}/></div><div><h2>{authMode==='signup'?'Create your account':'Welcome back'}</h2><p>{authMode==='signup'?'Create a NexaPulse Compute account using Supabase Auth. New accounts do not automatically receive owner privileges.':'Sign in to manage notebook enrollment. Owner-only actions require your account to be allowlisted by the Compute Worker.'}</p></div><div className="auth-switch"><button type="button" className={authMode==='signin'?'selected':''} onClick={()=>{setAuthMode('signin');setError('');setAuthMessage('');}}>Sign in</button><button type="button" className={authMode==='signup'?'selected':''} onClick={()=>{setAuthMode('signup');setError('');setAuthMessage('');}}>Create account</button></div><form onSubmit={authenticate} className="auth-form"><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com"/></label><label>Password<span className="password-field"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={authMode==='signup'?'new-password':'current-password'} minLength={6} required placeholder="At least 6 characters"/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button></span></label><button className="button primary" disabled={loading}>{loading?'Please wait…':authMode==='signup'?'Create account':'Sign in'}</button></form>{authMessage&&<div className="success-line"><CheckCircle2 size={14}/>{authMessage}</div>}{error&&<div className="error-line"><AlertCircle size={14}/>{error}</div>}</div>:<><div className="connection-head"><div><b>Owner session active</b><small>Enrollment actions use your Supabase access token.</small></div><button className="button tiny" onClick={onSignOut}><LogOut size={14}/> Sign out</button></div>{error&&<div className="error-line"><AlertCircle size={14}/>{error}</div>}
      <div className="section-heading"><div><h2>Pending approvals</h2><p>{pending.length} enrollment{pending.length===1?'':'s'} waiting for your decision</p></div><span className="count-pill">{pending.length}</span></div>
      {pending.length? <div className="enrollment-list">{pending.map(n=>{const expired=!!n.expires_at&&Date.parse(n.expires_at)<=Date.now();return <article className="enrollment-card" key={n.id}><div className="node-icon"><Server size={19}/></div><div className="node-main"><div className="node-name"><b>{n.name}</b><span className={`status-chip ${expired?'muted':'pending'}`}>{expired?'Expired · re-enroll':'Pending approval'}</span></div><p>{n.provider} · {n.model_id}</p><small>Submitted {formatDate(n.created_at)} · Expires {formatDate(n.expires_at)}</small><code>{n.id}</code></div><div className="node-actions"><button className="button primary" disabled={!!actionId||expired} onClick={()=>decide(n.id,'approve')}><Check size={15}/>{actionId===n.id?'Working…':'Approve'}</button><button className="button danger" disabled={!!actionId} onClick={()=>decide(n.id,'reject')}>Reject</button></div></article>})}</div>:<EmptyState icon={CheckCircle2} title={loaded?'No pending enrollments':'Enrollment list not loaded'} detail={loaded?'New notebook connections will appear here after the enrollment agent submits them.':'Refresh the list to check for notebook enrollment requests.'} action={!loaded?<button className="button secondary" onClick={loadEnrollments}>Load enrollments</button>:undefined}/>}
      <div className="section-heading spaced"><div><h2>Connected runtimes</h2><p>Approved nodes reported by the enrollment service</p></div></div>
      <div className="runtime-list">{enrollments.filter(n=>n.status==='approved').length?enrollments.filter(n=>n.status==='approved').map(n=><div className="runtime-row" key={n.id}><span className="runtime-symbol"><Cpu size={17}/></span><div><b>{n.name}</b><small>{n.provider} · {n.model_id}</small></div><span className="status-chip online"><StatusDot state="online"/> Approved</span><small>Last heartbeat {formatDate(n.last_seen_at)}</small></div>):<div className="subtle-empty">No approved runtime is listed yet. A node becomes active only after it has been approved and sends valid signed heartbeats.</div>}</div>
    </>}

  </section>;
}

function ModelsPage({token}:{token:string}){
  const [models,setModels]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [selected,setSelected]=useState('');const [prompt,setPrompt]=useState('');const [sending,setSending]=useState(false);const [messages,setMessages]=useState<{role:'user'|'assistant';content:string}[]>([]);
  useEffect(()=>{let live=true;if(!token){setModels([]);setLoading(false);return;}fetch(`${API_BASE}/v1/models`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||`Models endpoint returned ${r.status}`);return Array.isArray(d)?d:(d.models||[]);}).then(rows=>{if(live){setModels(rows);setSelected(old=>rows.some((m:any)=>m.id===old)?old:(rows[0]?.id||''));}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not load models.');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[token]);
  async function send(e:FormEvent){e.preventDefault();const content=prompt.trim();if(!content||!selected||!token||sending)return;const next=[...messages,{role:'user' as const,content}];setMessages(next);setPrompt('');setSending(true);setError('');try{const r=await fetch(`${API_BASE}/v1/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({model:selected,messages:next,max_tokens:512,temperature:0.7,top_p:0.9})});const d=await r.json();if(!r.ok)throw new Error(d.error||`Inference failed (${r.status})`);const answer=d.choices?.[0]?.message?.content;if(typeof answer!=='string')throw new Error('The runtime returned an invalid completion response.');setMessages(old=>[...old,{role:'assistant',content:answer}]);}catch(e){setError(e instanceof Error?e.message:'Model request failed.');}finally{setSending(false);}}
  return <section className="page"><PageTitle eyebrow="MODEL REGISTRY" title="Models" subtitle="Choose an available model and send requests to its connected notebook runtime."/><div className="card-panel live-list-panel">{loading?<p className="muted-copy">Loading model registry…</p>:error&&!models.length?<EmptyState icon={AlertCircle} title="Model registry unavailable" detail={error}/>:models.length?models.map((m,i)=><div className="live-row" key={m.id||m.model_id||i}><span className="resource-tile-icon"><Cpu size={18}/></span><div><b>{m.name||m.model_id||m.id||'Unnamed model'}</b><small>{m.runtime_count??1} runtime{(m.runtime_count??1)===1?'':'s'} · {m.status||'available'}</small></div></div>):<EmptyState icon={Cpu} title="No models registered" detail={token?'No approved runtime has registered a model yet.':'Sign in through Compute to load your model registry.'}/>}</div>{!!models.length&&<article className="card-panel model-chat-panel"><div className="panel-heading"><div><h2>Model playground</h2><p>Each request is routed to the selected model ID.</p></div><span className="status-chip secure">Live runtime</span></div><label className="field-label">Model<select value={selected} onChange={e=>{setSelected(e.target.value);setMessages([]);}}>{models.map((m:any)=><option key={m.id||m.model_id} value={m.id||m.model_id}>{m.name||m.id||m.model_id}</option>)}</select></label><div className="model-chat-messages">{messages.length?messages.map((m,i)=><div className={`model-message ${m.role}`} key={i}><b>{m.role==='user'?'You':selected}</b><p>{m.content}</p></div>):<div className="chat-empty">Send a message to test the selected model.</div>}{sending&&<div className="chat-empty">Generating response…</div>}</div><form className="model-chat-form" onSubmit={send}><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Message this model…" rows={2}/><button className="button primary" disabled={!prompt.trim()||sending||!selected}>{sending?'Generating…':'Send'}</button></form>{error&&<div className="error-line"><AlertCircle size={14}/>{error}</div>}</article>}</section>;
}

function AnalyticsPage({events}:{events:EventItem[]}){return <section className="page"><PageTitle eyebrow="WORKSPACE INSIGHTS" title="Analytics" subtitle="A factual view of what this dashboard can currently observe."/><div className="card-panel"><div className="panel-heading"><div><h2>Recent workspace events</h2><p>Only actions recorded by this dashboard are shown here.</p></div></div>{events.length?events.map(e=><div className="activity-row" key={e.id}><span className={`activity-mark ${e.kind}`}><Activity size={15}/></span><div><b>{e.title}</b><small>{e.detail}</small></div><time>{formatDate(e.time)}</time></div>):<EmptyState icon={Activity} title="No activity recorded" detail="Project imports, editor saves and node approval actions will appear here."/>}</div></section>;}

function SettingsPage({token,onSignOut}:{token:string;onSignOut:()=>void}){
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [showPassword,setShowPassword]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
  async function updateAccount(e:FormEvent){e.preventDefault();if(!token)return;const body:any={};if(email.trim())body.email=email.trim();if(password)body.password=password;if(!Object.keys(body).length){setError('Enter a new email address or password.');return;}setBusy(true);setError('');setMessage('');try{const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{method:'PUT',headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLIC_KEY,'Authorization':`Bearer ${token}`},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.msg||d.message||d.error_description||`Account update failed (${r.status})`);setMessage(body.email?'Email update requested. Check your inbox if confirmation is required.':'Password updated successfully.');setEmail('');setPassword('');}catch(e){setError(e instanceof Error?e.message:'Could not update account.');}finally{setBusy(false);}}
  async function deleteAccount(){if(!token||!window.confirm('Permanently delete your NexaPulse Compute account? This cannot be undone.'))return;setBusy(true);setError('');try{const r=await fetch(`${API_BASE}/v1/account`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Account deletion failed (${r.status})`);onSignOut();}catch(e){setError(e instanceof Error?e.message:'Account deletion is not available yet.');}finally{setBusy(false);}}
  return <section className="page"><PageTitle eyebrow="ACCOUNT" title="Settings" subtitle="Manage your sign-in details and account security."/><div className="settings-grid"><article className="card-panel account-settings"><div className="panel-heading"><div><h2>Account details</h2><p>Update the email address or password associated with your account.</p></div><ShieldCheck size={20}/></div><form onSubmit={updateAccount} className="settings-form"><label>New email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Leave blank to keep current email" autoComplete="email"/></label><label>New password<span className="password-field"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Leave blank to keep current password" autoComplete="new-password" minLength={8}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button></span></label><button className="button primary" disabled={busy||!token}>{busy?'Saving…':'Save account changes'}</button></form>{message&&<div className="success-line"><CheckCircle2 size={14}/>{message}</div>}{error&&<div className="error-line"><AlertCircle size={14}/>{error}</div>}</article><article className="card-panel"><div className="panel-heading"><div><h2>Session</h2><p>Sign out of this device.</p></div><LogOut size={20}/></div><button className="button secondary" onClick={onSignOut}><LogOut size={15}/> Sign out</button></article><article className="card-panel danger-zone"><div className="panel-heading"><div><h2>Delete account</h2><p>Permanently remove your account and associated access.</p></div><AlertCircle size={20}/></div><button className="button danger" disabled={busy||!token} onClick={deleteAccount}>Delete my account</button><p className="setting-note">Deletion requires a protected server-side operation. If the backend endpoint has not been deployed yet, this action will return an unavailable message and will not delete anything.</p></article></div></section>;
}

function DocsPage(){const [copied,setCopied]=useState(false);function download(){const blob=new Blob([agentSource],{type:'text/x-python;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nexapulse_compute_agent.py';a.click();URL.revokeObjectURL(url);}async function copy(){try{await navigator.clipboard.writeText(agentSource);setCopied(true);window.setTimeout(()=>setCopied(false),1600);}catch{setCopied(false);}}return <section className="page"><PageTitle eyebrow="DOCUMENTATION" title="Compute documentation" subtitle="Connect notebook runtimes and use the universal multi-model agent."/><div className="docs-grid"><article className="card-panel"><span className="docs-icon"><Cloud/></span><h2>1. Load your model or models</h2><p>Load model/tokenizer pairs in your Kaggle or Colab notebook. For multiple models, define a NEXAPULSE_MODELS dictionary that maps each model ID to its model and tokenizer pair.</p></article><article className="card-panel"><span className="docs-icon"><ShieldCheck/></span><h2>2. Connect the runtime</h2><p>Paste the agent below into the final notebook cell. It installs its dependencies, starts the local inference API, creates a Cloudflare tunnel, submits enrollment and maintains signed heartbeats.</p></article><article className="card-panel"><span className="docs-icon"><Cpu/></span><h2>3. Approve and chat</h2><p>Approve the runtime in Compute. Each registered model is listed separately and requests are routed by model ID to the matching model/tokenizer pair.</p></article></div><article className="card-panel agent-code-card"><div className="agent-code-head"><div><h2>Universal notebook connection agent</h2><p>Complete Python script · supports one or multiple loaded models</p></div><div className="agent-code-actions"><button className="button tiny secondary" onClick={copy}>{copied?<Check size={14}/>:<Code2 size={14}/>} {copied?'Copied':'Copy'}</button><button className="button tiny primary" onClick={download}><ArrowDownToLine size={14}/> Download</button></div></div><pre className="agent-code"><code>{agentSource}</code></pre></article></section>;}

export default function App(){
  const [tab,setTab]=useState<Tab>(()=>{try{const saved=localStorage.getItem('np-compute-tab');return saved==='ai'?'workspace':(saved as Tab)||'dashboard';}catch{return 'dashboard';}});
  const [apiState,setApiState]=useState<'online'|'offline'|'unknown'>('unknown');const [events,setEvents]=useState<EventItem[]>([]);const [ownerToken,setOwnerToken]=useState(()=>{try{return localStorage.getItem('np-compute-session')||'';}catch{return '';}});const [toast,setToast]=useState('');const [search,setSearch]=useState('');const [noticeOpen,setNoticeOpen]=useState(false);
  useEffect(()=>{dbGet<EventItem[]>('events').then(v=>{if(v)setEvents(v);}).catch(()=>{});},[]);
  useEffect(()=>{try{localStorage.setItem('np-compute-tab',tab);}catch{}},[tab]);
  useEffect(()=>{try{if(ownerToken)localStorage.setItem('np-compute-session',ownerToken);else localStorage.removeItem('np-compute-session');}catch{}},[ownerToken]);
  useEffect(()=>{let live=true;const check=async()=>{try{const r=await fetch(`${API_BASE}/health`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);if(live){setApiState('online');}}catch(e){if(live){setApiState('offline');}}};check();return()=>{live=false;};},[]);
  function recordEvent(title:string,detail:string,kind:EventItem['kind']='info'){const e:EventItem={id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,title,detail,time:new Date().toISOString(),kind};setEvents(old=>{const next=[e,...old].slice(0,40);dbSet('events',next).catch(()=>{});return next;});setToast(title);window.setTimeout(()=>setToast(''),2200);}
  const navItems:[Tab,typeof LayoutDashboard,string][]=[['dashboard',LayoutDashboard,'Overview'],['models',Sparkles,'Models'],['compute',Server,'Compute'],['workspace',Folder,'Projects'],['analytics',Activity,'Activity']];
  const titles:Record<Tab,string>={dashboard:'Overview',models:'Models',compute:'Compute',workspace:'Projects',analytics:'Activity',settings:'Settings',docs:'Documentation'};
  async function signOut(){if(ownerToken&&SUPABASE_URL&&SUPABASE_PUBLIC_KEY){try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:`Bearer ${ownerToken}`}});}catch{}}setOwnerToken('');}
  function go(next:Tab){setTab(next);}
  const filteredEvents=events.filter(e=>(e.title+' '+e.detail).toLowerCase().includes(search.toLowerCase()));
  const bottomNavItems:[Tab,typeof LayoutDashboard,string][]=[...navItems,['settings',Settings,'Settings'],['docs',CircleHelp,'Docs']];
  return <div className="app-shell fresh-shell"><main className="main-area fresh-main"><header className="topbar fresh-topbar"><button className="brand-home" onClick={()=>go('dashboard')}><IconMark/><span><b>NexaPulse</b><small>COMPUTE</small></span></button><div className="topbar-right"><span className="api-status"><StatusDot state={apiState}/><span>{apiState==='online'?'Worker online':apiState==='offline'?'Worker unavailable':'Checking'}</span></span><button className="top-icon" onClick={()=>setNoticeOpen(v=>!v)} aria-label="Notifications"><Bell size={17}/>{events.length>0&&<i/>}</button>{noticeOpen&&<div className="notification-pop"><div className="notification-head"><b>Recent activity</b><button type="button" aria-label="Close notifications" onClick={()=>setNoticeOpen(false)}><X size={14}/></button></div>{events.slice(0,4).map(e=><p key={e.id}>{e.title}<small>{e.detail}</small></p>)}{!events.length&&<small>No recorded activity.</small>}</div>}</div></header><div className="page-stack">
    <section className={`tab-view ${tab==='dashboard'?'visible':''}`}><PageTitle eyebrow="NEXAPULSE COMPUTE" title="Compute workspace" subtitle="Manage your connected runtimes, models and projects from one place." action={<button className="button primary" onClick={()=>go('compute')}><Plus size={16}/> Connect runtime</button>}/></section>
    <section className={`tab-view ${tab==='models'?'visible':''}`}><ModelsPage token={ownerToken}/></section><section className={`tab-view ${tab==='compute'?'visible':''}`}><ComputePage token={ownerToken} onToken={setOwnerToken} onSignOut={signOut} onEvent={recordEvent}/></section><section className={`tab-view ${tab==='workspace'?'visible':''}`}><ProjectWorkspace onEvent={recordEvent}/></section>
    <section className={`tab-view ${tab==='analytics'?'visible':''}`}><AnalyticsPage events={filteredEvents}/></section><section className={`tab-view ${tab==='settings'?'visible':''}`}><SettingsPage token={ownerToken} onSignOut={signOut}/></section><section className={`tab-view ${tab==='docs'?'visible':''}`}><DocsPage/></section>
    </div><footer className="fresh-footer"><span>NexaPulse Compute</span><small>Internal model testing environment</small></footer></main><nav className="bottom-navigation" aria-label="Main navigation">{bottomNavItems.map(([id,I,label])=>{const ItemIcon=I as typeof LayoutDashboard;return <button key={id as string} className={tab===id?'active':''} onClick={()=>go(id as Tab)}><ItemIcon size={17}/><span>{label as string}</span></button>;})}</nav>{toast&&<div className="toast"><CheckCircle2 size={15}/>{toast}</div>}</div>;
}
