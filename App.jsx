import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── DB helpers ───────────────────────────────────────────────────────────────
// Map DB snake_case rows → app camelCase objects
const fromDb = (row) => row ? ({
  ...row,
  projectId:  row.project_id  ?? row.projectId  ?? null,
  userId:     row.user_id     ?? row.userId     ?? null,
  userName:   row.user_name   ?? row.userName   ?? null,
  userColor:  row.user_color  ?? row.userColor  ?? null,
  startTime:  row.start_time  ?? row.startTime  ?? null,
  endTime:    row.end_time    ?? row.endTime    ?? null,
}) : null;

// Map app camelCase → DB snake_case columns
const toDb = (obj) => {
  const r = { ...obj };
  if ('projectId'  in r) { r.project_id  = r.projectId;  delete r.projectId; }
  if ('userId'     in r) { r.user_id     = r.userId;     delete r.userId; }
  if ('userName'   in r) { r.user_name   = r.userName;   delete r.userName; }
  if ('userColor'  in r) { r.user_color  = r.userColor;  delete r.userColor; }
  if ('startTime'  in r) { r.start_time  = r.startTime;  delete r.startTime; }
  if ('endTime'    in r) { r.end_time    = r.endTime;    delete r.endTime; }
  return r;
};

// ─── Utils ────────────────────────────────────────────────────────────────────
const genId   = () => Math.random().toString(36).slice(2, 10);
const pad     = n  => String(n).padStart(2, "0");
const fmtDur  = s  => { if (!s || s < 0) s = 0; return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`; };
const fmtHM   = s  => { if (!s || s < 0) s = 0; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h===0?`${m}m`:m===0?`${h}h`:`${h}h ${m}m`; };
const fmtTime = ts => new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const dayKey  = ts => { const d=new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const dayLabel= ts => {
  const d=new Date(ts),t=new Date(),y=new Date(); y.setDate(t.getDate()-1);
  if(dayKey(d)===dayKey(t)) return "Today";
  if(dayKey(d)===dayKey(y)) return "Yesterday";
  return d.toLocaleDateString("de-AT",{weekday:"long",month:"short",day:"numeric"});
};
const weekStart = (off=0) => {
  const d=new Date(); d.setDate(d.getDate()+(d.getDay()===0?-6:1-d.getDay())+off*7); d.setHours(0,0,0,0); return d;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const PALETTE = ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444","#06b6d4","#ec4899","#84cc16","#f97316","#a855f7"];
const ACOLORS = ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444","#06b6d4","#ec4899","#f97316"];
const C = {
  bg:"#0b0e14", card:"#111827", b1:"#1a2236", b2:"#232d42",
  amber:"#f59e0b", red:"#ef4444", green:"#10b981",
  t1:"#f1f5f9", t2:"#8892a4", t3:"#3d4f66",
  mono:"'JetBrains Mono','Courier New',monospace",
  sans:"'Outfit',system-ui,sans-serif",
};
const B = (x={})=>({cursor:"pointer",border:"none",borderRadius:8,fontFamily:C.sans,fontSize:13,fontWeight:600,transition:"all 0.15s",...x});

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Avatar({name,color,size=28}){
  const ini=(name||"?").split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
  return <div style={{width:size,height:size,borderRadius:Math.round(size/3.5),background:`${color}22`,border:`1.5px solid ${color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:700,color,flexShrink:0}}>{ini}</div>;
}
function ProjBadge({project}){
  if(!project) return <span style={{fontSize:11,color:C.t3,padding:"2px 8px",borderRadius:4,border:`1px solid ${C.b2}`}}>—</span>;
  return <span style={{fontSize:11,color:project.color,padding:"2px 8px",borderRadius:4,border:`1px solid ${project.color}33`,background:`${project.color}11`,fontWeight:600,whiteSpace:"nowrap"}}>{project.name}</span>;
}
function Sel({value,onChange,options,placeholder,style={}}){
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{background:C.bg,border:`1px solid ${C.b2}`,color:value?C.t1:C.t3,padding:"0 12px",borderRadius:8,fontSize:13,height:42,fontFamily:C.sans,cursor:"pointer",...style}}>
    <option value="">{placeholder||"Select…"}</option>
    {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
  </select>;
}
function Inp({style={},...props}){
  return <input {...props} style={{background:C.bg,border:`1px solid ${C.b2}`,color:C.t1,padding:"0 12px",borderRadius:8,height:40,fontSize:13,fontFamily:C.sans,outline:"none",...style}}/>;
}
function SectionHeader({label,right}){
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,padding:"0 2px"}}>
    <span style={{fontSize:10,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</span>
    {right&&<span style={{fontSize:11,color:C.t2,fontFamily:C.mono}}>{right}</span>}
  </div>;
}
function Spinner(){
  return <div style={{display:"inline-block",width:14,height:14,border:`2px solid ${C.b2}`,borderTopColor:C.amber,borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>;
}

// ─── User Setup ───────────────────────────────────────────────────────────────
function UserSetup({onDone}){
  const [name,setName]=useState("");
  const [color,setColor]=useState(ACOLORS[0]);
  const submit=()=>{ if(!name.trim())return; onDone({id:genId(),name:name.trim(),color}); };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.sans}}>
      <div style={{background:C.card,border:`1px solid ${C.b2}`,borderRadius:18,padding:"40px 44px",width:380}}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:30}}>
          <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${C.amber},#ef4444)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14.5"/></svg>
          </div>
          <span style={{fontWeight:700,fontSize:16,letterSpacing:"-0.02em",color:C.t1}}>Zeitwerk</span>
        </div>
        <h2 style={{fontSize:22,fontWeight:700,color:C.t1,marginBottom:6,letterSpacing:"-0.02em"}}>Welcome aboard</h2>
        <p style={{fontSize:13,color:C.t3,marginBottom:28,lineHeight:1.6}}>Your name shows up in the Team tab so colleagues see who's working on what — in real time.</p>
        <div style={{marginBottom:18}}>
          <label style={{fontSize:10,color:C.t3,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Your name</label>
          <Inp value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="e.g. Anna Müller" style={{width:"100%",height:46,fontSize:15}} autoFocus/>
        </div>
        <div style={{marginBottom:30}}>
          <label style={{fontSize:10,color:C.t3,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Your color</label>
          <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
            {ACOLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{width:30,height:30,borderRadius:7,background:c,border:`2.5px solid ${color===c?"#fff":"transparent"}`,cursor:"pointer",transition:"transform 0.12s",transform:color===c?"scale(1.18)":"scale(1)"}}/>)}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {name.trim()&&<Avatar name={name.trim()} color={color} size={36}/>}
          <button onClick={submit} disabled={!name.trim()} style={B({flex:1,height:46,background:name.trim()?C.amber:C.b2,color:name.trim()?C.bg:C.t3,fontSize:14})}>
            Start tracking →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({entry,project,onDelete,onUpdate,projects,readOnly=false}){
  const [editing,setEditing]=useState(false);
  const [desc,setDesc]=useState(entry.description);
  const [projId,setProjId]=useState(entry.projectId||"");
  useEffect(()=>{ setDesc(entry.description); setProjId(entry.projectId||""); },[entry.id,entry.description,entry.projectId]);

  const save=()=>{ onUpdate({...entry,description:desc.trim()||"No description",projectId:projId||null}); setEditing(false); };
  const cancel=()=>{ setDesc(entry.description); setProjId(entry.projectId||""); setEditing(false); };

  if(editing) return (
    <div style={{background:C.card,border:`1px solid ${C.amber}55`,borderRadius:10,padding:"10px 14px",marginBottom:5,display:"flex",alignItems:"center",gap:8}}>
      <input value={desc} onChange={e=>setDesc(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")cancel();}} autoFocus
        style={{flex:1,background:"transparent",border:"none",color:C.t1,fontSize:14,outline:"none",fontFamily:C.sans}}/>
      <Sel value={projId} onChange={setProjId} options={projects.map(p=>({value:p.id,label:p.name}))} placeholder="No project" style={{height:36,minWidth:140}}/>
      <button onClick={save} style={B({padding:"6px 14px",background:C.amber,color:C.bg})}>Save</button>
      <button onClick={cancel} style={B({padding:"6px 10px",background:C.b2,color:C.t2})}>✕</button>
    </div>
  );

  return (
    <div style={{background:C.card,border:"1px solid #0f1620",borderRadius:10,padding:"10px 14px",marginBottom:5,display:"flex",alignItems:"center",gap:12,transition:"border-color 0.15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=C.b2}
      onMouseLeave={e=>e.currentTarget.style.borderColor="#0f1620"}>
      {project&&<div style={{width:3,height:26,borderRadius:2,background:project.color,flexShrink:0}}/>}
      {entry.userName&&<Avatar name={entry.userName} color={entry.userColor||C.amber} size={22}/>}
      <span onClick={()=>!readOnly&&setEditing(true)}
        style={{flex:1,fontSize:13,color:entry.description==="No description"?C.t3:C.t2,cursor:readOnly?"default":"text",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {entry.description}
      </span>
      <ProjBadge project={project}/>
      <span style={{fontSize:11,color:C.t3,fontFamily:C.mono,whiteSpace:"nowrap"}}>{fmtTime(entry.startTime)}–{fmtTime(entry.endTime)}</span>
      <span style={{fontSize:13,color:C.t2,fontFamily:C.mono,minWidth:70,textAlign:"right",fontWeight:600}}>{fmtDur(entry.duration)}</span>
      {!readOnly&&(
        <button onClick={()=>onDelete(entry.id)}
          style={{background:"none",border:"none",color:C.t3,padding:4,borderRadius:4,display:"flex",alignItems:"center",cursor:"pointer",transition:"color 0.15s",flexShrink:0}}
          onMouseEnter={e=>e.currentTarget.style.color=C.red}
          onMouseLeave={e=>e.currentTarget.style.color=C.t3}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      )}
    </div>
  );
}

// ─── Timer Tab ────────────────────────────────────────────────────────────────
function TimerTab({timerDesc,setTimerDesc,timerProject,setTimerProject,running,elapsed,startTimer,stopTimer,entries,projects,getProject,deleteEntry,updateEntry}){
  const todayEntries=entries.filter(e=>dayKey(e.startTime)===dayKey(Date.now())).sort((a,b)=>b.startTime-a.startTime);
  const todaySec=todayEntries.reduce((s,e)=>s+e.duration,0)+(running?elapsed:0);
  return (
    <div>
      <div style={{background:C.card,border:`1px solid ${running?C.amber+"44":C.b1}`,borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,marginBottom:32,transition:"all 0.3s",boxShadow:running?`0 0 32px ${C.amber}08`:"none"}}>
        <input value={timerDesc} onChange={e=>setTimerDesc(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!running)startTimer();}}
          placeholder="What are you working on?"
          style={{flex:1,background:"transparent",border:"none",color:C.t1,fontSize:15,fontFamily:C.sans,outline:"none",minWidth:0}}/>
        <Sel value={timerProject} onChange={setTimerProject} options={projects.map(p=>({value:p.id,label:p.name}))} placeholder="Project" style={{minWidth:150,height:40}}/>
        <div style={{fontFamily:C.mono,fontSize:22,fontWeight:700,color:running?C.amber:C.t3,minWidth:98,textAlign:"center",letterSpacing:"-0.02em",transition:"color 0.3s"}}>
          {fmtDur(elapsed)}
        </div>
        <button onClick={running?stopTimer:startTimer}
          style={{width:42,height:42,borderRadius:10,border:"none",flexShrink:0,background:running?"#ef444418":"#f59e0b18",color:running?C.red:C.amber,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",cursor:"pointer"}}>
          {running
            ?<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            :<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
        </button>
      </div>
      {todayEntries.length>0&&(
        <div>
          <SectionHeader label="Today" right={fmtHM(todaySec)}/>
          {todayEntries.map(e=><EntryRow key={e.id} entry={e} project={getProject(e.projectId)} onDelete={deleteEntry} onUpdate={updateEntry} projects={projects}/>)}
        </div>
      )}
      {todayEntries.length===0&&!running&&(
        <div style={{textAlign:"center",padding:"72px 0",color:C.t3}}>
          <div style={{fontSize:30,marginBottom:12,opacity:0.2}}>⏱</div>
          <div style={{fontSize:14,marginBottom:4}}>No time tracked today</div>
          <div style={{fontSize:12}}>Press play or hit Enter to start</div>
        </div>
      )}
    </div>
  );
}

// ─── Log Tab ──────────────────────────────────────────────────────────────────
function LogTab({user,entries,projects,getProject,deleteEntry,updateEntry,addEntry}){
  const [showForm,setShowForm]=useState(false);
  const today=new Date().toISOString().slice(0,10);
  const [form,setForm]=useState({desc:"",proj:"",date:today,start:"09:00",end:"10:00"});
  const setF=k=>v=>setForm(f=>({...f,[k]:v}));

  const addManual=()=>{
    const st=new Date(`${form.date}T${form.start}`).getTime();
    const et=new Date(`${form.date}T${form.end}`).getTime();
    if(isNaN(st)||isNaN(et)||et<=st) return;
    addEntry({id:genId(),description:form.desc.trim()||"No description",projectId:form.proj||null,startTime:st,endTime:et,duration:Math.floor((et-st)/1000),userId:user.id,userName:user.name,userColor:user.color});
    setShowForm(false);
    setForm({desc:"",proj:"",date:today,start:"09:00",end:"10:00"});
  };

  const groups=entries.reduce((acc,e)=>{ const k=dayKey(e.startTime);(acc[k]=acc[k]||[]).push(e);return acc; },{});
  const sortedDays=Object.keys(groups).sort((a,b)=>b.localeCompare(a));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h2 style={{fontSize:18,fontWeight:700,letterSpacing:"-0.02em",color:C.t1}}>Time Log</h2>
        <button onClick={()=>setShowForm(v=>!v)} style={B({padding:"8px 16px",background:C.amber,color:C.bg,display:"flex",alignItems:"center",gap:6})}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Entry
        </button>
      </div>
      {showForm&&(
        <div style={{background:C.card,border:`1px solid ${C.amber}22`,borderRadius:12,padding:20,marginBottom:24}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:12,alignItems:"end",marginBottom:14}}>
            <div>
              <label style={{fontSize:10,color:C.t3,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>Description</label>
              <Inp value={form.desc} onChange={e=>setF("desc")(e.target.value)} placeholder="What did you work on?" style={{width:"100%"}}/>
            </div>
            <div>
              <label style={{fontSize:10,color:C.t3,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>Date</label>
              <Inp type="date" value={form.date} onChange={e=>setF("date")(e.target.value)} style={{colorScheme:"dark"}}/>
            </div>
            <div>
              <label style={{fontSize:10,color:C.t3,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>Start – End</label>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <Inp type="time" value={form.start} onChange={e=>setF("start")(e.target.value)} style={{colorScheme:"dark",width:88}}/>
                <span style={{color:C.t3,fontSize:12}}>–</span>
                <Inp type="time" value={form.end} onChange={e=>setF("end")(e.target.value)} style={{colorScheme:"dark",width:88}}/>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <Sel value={form.proj} onChange={setF("proj")} options={projects.map(p=>({value:p.id,label:p.name}))} placeholder="No project" style={{minWidth:160}}/>
            <button onClick={addManual} style={B({padding:"0 18px",height:40,background:C.amber,color:C.bg})}>Add</button>
            <button onClick={()=>setShowForm(false)} style={B({padding:"0 12px",height:40,background:"none",border:`1px solid ${C.b2}`,color:C.t2})}>Cancel</button>
          </div>
        </div>
      )}
      {sortedDays.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:C.t3,fontSize:14}}>No entries yet. Start tracking!</div>}
      {sortedDays.map(day=>{
        const de=groups[day].sort((a,b)=>b.startTime-a.startTime);
        return (
          <div key={day} style={{marginBottom:24}}>
            <SectionHeader label={dayLabel(de[0].startTime)} right={fmtHM(de.reduce((s,e)=>s+e.duration,0))}/>
            {de.map(e=><EntryRow key={e.id} entry={e} project={getProject(e.projectId)} onDelete={deleteEntry} onUpdate={updateEntry} projects={projects}/>)}
          </div>
        );
      })}
    </div>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────
function ProjectsTab({projects,addProject,deleteProject,entries}){
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({name:"",client:"",color:PALETTE[0]});
  const setF=k=>v=>setForm(f=>({...f,[k]:v}));

  const add=()=>{
    if(!form.name.trim()) return;
    addProject({id:genId(),name:form.name.trim(),client:form.client.trim(),color:form.color});
    setForm({name:"",client:"",color:PALETTE[Math.floor(Math.random()*PALETTE.length)]});
    setShowForm(false);
  };
  const stats=id=>({
    total:entries.filter(e=>e.projectId===id).reduce((s,e)=>s+e.duration,0),
    count:entries.filter(e=>e.projectId===id).length,
  });

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h2 style={{fontSize:18,fontWeight:700,letterSpacing:"-0.02em",color:C.t1}}>Projects</h2>
        <button onClick={()=>setShowForm(v=>!v)} style={B({padding:"8px 16px",background:C.amber,color:C.bg,display:"flex",alignItems:"center",gap:6})}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </button>
      </div>
      {showForm&&(
        <div style={{background:C.card,border:`1px solid ${C.amber}22`,borderRadius:12,padding:20,marginBottom:24}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <div>
              <label style={{fontSize:10,color:C.t3,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>Project name *</label>
              <Inp value={form.name} onChange={e=>setF("name")(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="e.g. S/4HANA Migration" style={{width:"100%"}}/>
            </div>
            <div>
              <label style={{fontSize:10,color:C.t3,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>Client (optional)</label>
              <Inp value={form.client} onChange={e=>setF("client")(e.target.value)} placeholder="e.g. Acme Corp" style={{width:"100%"}}/>
            </div>
          </div>
          <div style={{marginBottom:18}}>
            <label style={{fontSize:10,color:C.t3,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Color</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {PALETTE.map(c=><button key={c} onClick={()=>setF("color")(c)} style={{width:26,height:26,borderRadius:6,background:c,border:`2px solid ${form.color===c?"#fff":"transparent"}`,cursor:"pointer",transition:"transform 0.1s",transform:form.color===c?"scale(1.18)":"scale(1)"}}/>)}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} style={B({padding:"8px 22px",background:C.amber,color:C.bg})}>Create Project</button>
            <button onClick={()=>setShowForm(false)} style={B({padding:"8px 14px",background:"none",border:`1px solid ${C.b2}`,color:C.t2})}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {projects.map(p=>{
          const {total,count}=stats(p.id);
          return (
            <div key={p.id}
              style={{background:C.card,border:"1px solid #0f1620",borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.b2}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#0f1620"}>
              <div style={{width:36,height:36,borderRadius:9,background:`${p.color}18`,border:`1px solid ${p.color}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:p.color}}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14,color:C.t1}}>{p.name}</div>
                {p.client&&<div style={{fontSize:11,color:C.t3,marginTop:2}}>{p.client}</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:14,fontFamily:C.mono,color:C.t2,fontWeight:600}}>{fmtHM(total)}</div>
                <div style={{fontSize:11,color:C.t3,marginTop:2}}>{count} {count===1?"entry":"entries"}</div>
              </div>
              <button onClick={()=>deleteProject(p.id)}
                style={{background:"none",border:"none",color:C.t3,padding:6,borderRadius:6,display:"flex",cursor:"pointer",transition:"color 0.15s",flexShrink:0}}
                onMouseEnter={e=>e.currentTarget.style.color=C.red}
                onMouseLeave={e=>e.currentTarget.style.color=C.t3}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          );
        })}
        {projects.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:C.t3,fontSize:14}}>No projects yet.</div>}
      </div>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({entries,projects}){
  const [weekOff,setWeekOff]=useState(0);
  const ws=weekStart(weekOff), we=new Date(ws); we.setDate(ws.getDate()+7);
  const wEntries=entries.filter(e=>{const d=new Date(e.startTime);return d>=ws&&d<we;});
  const totalSec=wEntries.reduce((s,e)=>s+e.duration,0);

  const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const dailyData=DAYS.map((name,i)=>{
    const ds=new Date(ws); ds.setDate(ws.getDate()+i);
    const de=new Date(ds); de.setDate(ds.getDate()+1);
    const sec=wEntries.filter(e=>{const d=new Date(e.startTime);return d>=ds&&d<de;}).reduce((s,e)=>s+e.duration,0);
    return {name,hours:parseFloat((sec/3600).toFixed(2)),isToday:dayKey(ds)===dayKey(Date.now())};
  });

  const byProj=projects.map(p=>({name:p.name,color:p.color,value:wEntries.filter(e=>e.projectId===p.id).reduce((s,e)=>s+e.duration,0)})).filter(p=>p.value>0);
  const noProj=wEntries.filter(e=>!e.projectId).reduce((s,e)=>s+e.duration,0);
  if(noProj>0) byProj.push({name:"No Project",color:C.t3,value:noProj});

  const wLabel=`${ws.toLocaleDateString("de-AT",{month:"short",day:"numeric"})} – ${new Date(we-1).toLocaleDateString("de-AT",{month:"short",day:"numeric"})}`;
  const activeDays=dailyData.slice(0,5).filter(d=>d.hours>0).length||1;
  const Tip=({active,payload,label})=>active&&payload?.length?<div style={{background:C.b2,border:`1px solid ${C.b1}`,borderRadius:8,padding:"8px 12px",fontSize:12}}><div style={{color:C.t2,marginBottom:3}}>{label}</div><div style={{fontFamily:C.mono,color:C.amber,fontWeight:700}}>{payload[0].value}h</div></div>:null;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h2 style={{fontSize:18,fontWeight:700,letterSpacing:"-0.02em",color:C.t1}}>Reports</h2>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setWeekOff(w=>w-1)} style={B({width:30,height:30,padding:0,background:C.card,border:`1px solid ${C.b2}`,color:C.t2,display:"flex",alignItems:"center",justifyContent:"center"})}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{fontSize:12,color:C.t2,minWidth:158,textAlign:"center"}}>{wLabel}</span>
          <button onClick={()=>setWeekOff(w=>Math.min(0,w+1))} disabled={weekOff>=0}
            style={B({width:30,height:30,padding:0,background:C.card,border:`1px solid ${C.b2}`,color:weekOff>=0?C.t3:C.t2,display:"flex",alignItems:"center",justifyContent:"center"})}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[
          {label:"Total time",value:fmtHM(totalSec),sub:`${(totalSec/3600).toFixed(1)}h logged`},
          {label:"Daily avg",value:fmtHM(Math.round(totalSec/activeDays)),sub:"per active day"},
          {label:"Entries",value:wEntries.length,sub:"time entries"},
        ].map(s=>(
          <div key={s.label} style={{background:C.card,border:"1px solid #0f1620",borderRadius:12,padding:"16px 18px"}}>
            <div style={{fontSize:10,color:C.t3,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{s.label}</div>
            <div style={{fontSize:22,fontFamily:C.mono,fontWeight:700,color:C.amber,letterSpacing:"-0.02em"}}>{s.value}</div>
            <div style={{fontSize:11,color:C.t3,marginTop:4}}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{background:C.card,border:"1px solid #0f1620",borderRadius:12,padding:"18px 20px",marginBottom:12}}>
        <div style={{fontSize:10,color:C.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14}}>Hours per day</div>
        <ResponsiveContainer width="100%" height={148}>
          <BarChart data={dailyData} barSize={26}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:C.t3,fontSize:11,fontFamily:"Outfit,sans-serif"}}/>
            <YAxis axisLine={false} tickLine={false} tick={{fill:C.t3,fontSize:10}} unit="h" width={28}/>
            <Tooltip content={<Tip/>} cursor={{fill:"#ffffff05"}}/>
            <Bar dataKey="hours" radius={[4,4,0,0]}>
              {dailyData.map((d,i)=><Cell key={i} fill={d.isToday?C.amber:"#1e3a5f"}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {byProj.length>0&&(
        <div style={{background:C.card,border:"1px solid #0f1620",borderRadius:12,padding:"18px 20px"}}>
          <div style={{fontSize:10,color:C.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:16}}>By project</div>
          <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:20,alignItems:"center"}}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart><Pie data={byProj} dataKey="value" cx="50%" cy="50%" innerRadius={46} outerRadius={72} paddingAngle={3}>{byProj.map((p,i)=><Cell key={i} fill={p.color}/>)}</Pie></PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {byProj.map(p=>(
                <div key={p.name} style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:8,height:8,borderRadius:2,background:p.color,flexShrink:0}}/>
                  <span style={{flex:1,fontSize:13,color:C.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                  <span style={{fontSize:13,fontFamily:C.mono,color:C.t1,fontWeight:600}}>{fmtHM(p.value)}</span>
                  <span style={{fontSize:11,color:C.t3,minWidth:34,textAlign:"right"}}>{totalSec>0?Math.round(p.value/totalSec*100):0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {wEntries.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.t3,fontSize:13}}>No entries this week.</div>}
    </div>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────
function TeamTab({currentUser,activeUsers,teamEntries,projects,getProject,lastRefresh,refreshing}){
  const now=Date.now();
  const todayTeam=teamEntries.filter(e=>dayKey(e.startTime)===dayKey(now));
  const userMap={};
  todayTeam.forEach(e=>{
    if(!userMap[e.userId]) userMap[e.userId]={id:e.userId,name:e.userName||"Unknown",color:e.userColor||C.amber,entries:[]};
    userMap[e.userId].entries.push(e);
  });
  activeUsers.forEach(a=>{
    if(!userMap[a.userId]) userMap[a.userId]={id:a.userId,name:a.userName,color:a.userColor||C.amber,entries:[]};
  });
  const members=Object.values(userMap).sort((a,b)=>a.name.localeCompare(b.name));
  const isActive=uid=>activeUsers.some(a=>a.userId===uid);
  const grandTotal=todayTeam.reduce((s,e)=>s+e.duration,0);
  const projBreakdown=projects.map(p=>({...p,total:todayTeam.filter(e=>e.projectId===p.id).reduce((s,e)=>s+e.duration,0)})).filter(p=>p.total>0).sort((a,b)=>b.total-a.total);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:700,letterSpacing:"-0.02em",color:C.t1}}>Team</h2>
          <p style={{fontSize:12,color:C.t3,marginTop:3}}>Live view of all team members' activity today</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {refreshing&&<Spinner/>}
          {lastRefresh&&<span style={{fontSize:11,color:C.t3}}>Updated {new Date(lastRefresh).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
        </div>
      </div>

      {activeUsers.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.green}22`,borderRadius:12,padding:"16px 18px",marginBottom:20}}>
          <div style={{fontSize:10,color:C.green,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.green,animation:"pulse 1.4s infinite"}}/>
            Tracking right now
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {activeUsers.map(a=>{
              const elapsed=Math.floor((now-a.startTime)/1000);
              const proj=getProject(a.projectId);
              return (
                <div key={a.userId} style={{display:"flex",alignItems:"center",gap:12}}>
                  <Avatar name={a.userName} color={a.userColor||C.amber} size={32}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.t1}}>{a.userName}{a.userId===currentUser.id&&<span style={{fontSize:10,color:C.t3,marginLeft:6,fontWeight:400}}>(you)</span>}</div>
                    <div style={{fontSize:12,color:C.t3,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.description||"Working…"}</div>
                  </div>
                  {proj&&<ProjBadge project={proj}/>}
                  <div style={{fontFamily:C.mono,fontSize:14,fontWeight:700,color:C.green,minWidth:72,textAlign:"right"}}>{fmtDur(elapsed)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {members.length>0&&(
        <div style={{marginBottom:20}}>
          <SectionHeader label={`Team today${grandTotal>0?" — "+fmtHM(grandTotal)+" total":""}`}/>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {members.map(member=>{
              const mTotal=member.entries.reduce((s,e)=>s+e.duration,0);
              const active=isActive(member.id);
              return (
                <div key={member.id} style={{background:C.card,border:`1px solid ${active?"#10b98122":"#0f1620"}`,borderRadius:12,padding:"12px 16px",transition:"border-color 0.3s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:member.entries.length>0?10:0}}>
                    <Avatar name={member.name} color={member.color} size={30}/>
                    <span style={{fontWeight:600,fontSize:13,color:C.t1,flex:1}}>{member.name}{member.id===currentUser.id&&<span style={{fontSize:10,color:C.t3,marginLeft:6,fontWeight:400}}>(you)</span>}</span>
                    {active&&<span style={{fontSize:10,background:"#10b98118",color:C.green,padding:"2px 8px",borderRadius:4,fontWeight:600,border:"1px solid #10b98133"}}>● Active</span>}
                    <span style={{fontFamily:C.mono,fontSize:13,fontWeight:700,color:mTotal>0?C.t2:C.t3}}>{fmtHM(mTotal)}</span>
                  </div>
                  {member.entries.length>0&&(
                    <div style={{paddingLeft:40,display:"flex",flexDirection:"column"}}>
                      {member.entries.sort((a,b)=>b.startTime-a.startTime).map(e=>{
                        const proj=getProject(e.projectId);
                        return (
                          <div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:"1px solid #0f1620"}}>
                            {proj&&<div style={{width:3,height:18,borderRadius:1,background:proj.color,flexShrink:0}}/>}
                            <span style={{flex:1,fontSize:12,color:e.description==="No description"?C.t3:C.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.description}</span>
                            <ProjBadge project={proj}/>
                            <span style={{fontSize:11,fontFamily:C.mono,color:C.t3,minWidth:58,textAlign:"right"}}>{fmtDur(e.duration)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {projBreakdown.length>0&&(
        <div style={{background:C.card,border:"1px solid #0f1620",borderRadius:12,padding:"16px 18px"}}>
          <SectionHeader label="Projects today"/>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:10}}>
            {projBreakdown.map(p=>{
              const pct=grandTotal>0?Math.round(p.total/grandTotal*100):0;
              return (
                <div key={p.id}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}>
                    <div style={{width:8,height:8,borderRadius:2,background:p.color,flexShrink:0}}/>
                    <span style={{flex:1,fontSize:13,color:C.t2}}>{p.name}</span>
                    {p.client&&<span style={{fontSize:11,color:C.t3}}>{p.client}</span>}
                    <span style={{fontSize:13,fontFamily:C.mono,fontWeight:600,color:C.t1}}>{fmtHM(p.total)}</span>
                    <span style={{fontSize:11,color:C.t3,minWidth:32,textAlign:"right"}}>{pct}%</span>
                  </div>
                  <div style={{height:3,borderRadius:2,background:C.b2,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,height:"100%",background:p.color,borderRadius:2,transition:"width 0.6s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {members.length===0&&(
        <div style={{textAlign:"center",padding:"60px 0",color:C.t3}}>
          <div style={{fontSize:28,marginBottom:12,opacity:0.2}}>👥</div>
          <div style={{fontSize:14,marginBottom:4}}>No team activity today</div>
          <div style={{fontSize:12}}>Entries appear here once teammates start tracking</div>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App(){
  // User identity stored in localStorage (persists per browser, no auth needed)
  const [user,         setUser]         = useState(null);
  const [userReady,    setUserReady]    = useState(false);

  // App data
  const [entries,      setEntries]      = useState([]);
  const [projects,     setProjects]     = useState([]);
  const [running,      setRunning]      = useState(null);
  const [elapsed,      setElapsed]      = useState(0);
  const [timerDesc,    setTimerDesc]    = useState("");
  const [timerProject, setTimerProject] = useState("");
  const [tab,          setTab]          = useState("timer");
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // Team
  const [activeUsers,  setActiveUsers]  = useState([]);
  const [teamEntries,  setTeamEntries]  = useState([]);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);

  // ── Load user from localStorage
  useEffect(()=>{
    try{
      const stored=localStorage.getItem("zt:user");
      if(stored) setUser(JSON.parse(stored));
    }catch{}
    setUserReady(true);
  },[]);

  // ── Save user to localStorage
  useEffect(()=>{ if(user) localStorage.setItem("zt:user",JSON.stringify(user)); },[user]);

  // ── Load data from Supabase on startup
  useEffect(()=>{
    if(!user) return;
    setLoading(true);
    setError(null);
    (async()=>{
      try{
        // Projects (shared)
        const { data: proj, error: pe } = await supabase.from("projects").select("*").order("created_at");
        if(pe) throw pe;
        setProjects((proj||[]).map(fromDb));

        // My entries
        const { data: ent, error: ee } = await supabase.from("entries").select("*").eq("user_id",user.id).order("start_time",{ascending:false});
        if(ee) throw ee;
        setEntries((ent||[]).map(fromDb));

        // My running timer
        const { data: timer } = await supabase.from("active_timers").select("*").eq("user_id",user.id).maybeSingle();
        if(timer){
          const t=fromDb(timer);
          setRunning({description:t.description,projectId:t.projectId,startTime:t.startTime});
          setTimerDesc(t.description||"");
          setTimerProject(t.projectId||"");
        }
      }catch(err){
        console.error(err);
        setError("Could not connect to database. Check your .env file.");
      }finally{
        setLoading(false);
      }
    })();
  },[user]);

  // ── Subscribe to real-time changes from teammates
  useEffect(()=>{
    if(!user) return;
    // Listen to active_timers for live "who is tracking" updates
    const ch = supabase.channel("team-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"active_timers"},()=>pollTeam())
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[user]);

  // ── Timer tick
  useEffect(()=>{
    if(!running){ setElapsed(0); return; }
    const upd=()=>setElapsed(Math.floor((Date.now()-running.startTime)/1000));
    upd(); const id=setInterval(upd,1000); return()=>clearInterval(id);
  },[running]);

  // ── Poll team data (also triggered by real-time subscription)
  const pollTeam=useCallback(async()=>{
    if(!user) return;
    setRefreshing(true);
    try{
      const { data: active } = await supabase.from("active_timers").select("*");
      setActiveUsers((active||[]).map(fromDb));

      // Today's team entries
      const dayStart=new Date(); dayStart.setHours(0,0,0,0);
      const { data: team } = await supabase.from("entries").select("*").gte("start_time",dayStart.getTime());
      setTeamEntries((team||[]).map(fromDb));
      setLastRefresh(Date.now());
    }finally{ setRefreshing(false); }
  },[user]);

  useEffect(()=>{ pollTeam(); const id=setInterval(pollTeam,20000); return()=>clearInterval(id); },[pollTeam]);

  // ── Timer actions
  const startTimer=async()=>{
    const r={description:timerDesc,projectId:timerProject||null,startTime:Date.now()};
    setRunning(r);
    await supabase.from("active_timers").upsert(toDb({
      userId:user.id,userName:user.name,userColor:user.color,
      description:timerDesc,projectId:timerProject||null,startTime:r.startTime,
    }));
  };

  const stopTimer=async()=>{
    if(!running) return;
    const dur=Math.floor((Date.now()-running.startTime)/1000);
    setRunning(null); setTimerDesc(""); setTimerProject("");
    if(dur>=1){
      const entry={
        id:genId(),description:running.description||"No description",
        projectId:running.projectId,startTime:running.startTime,endTime:Date.now(),duration:dur,
        userId:user.id,userName:user.name,userColor:user.color,
      };
      setEntries(prev=>[entry,...prev]);
      await supabase.from("entries").insert(toDb(entry));
    }
    await supabase.from("active_timers").delete().eq("user_id",user.id);
    pollTeam();
  };

  // ── Entry CRUD
  const addEntry=async(entry)=>{
    setEntries(prev=>[entry,...prev]);
    await supabase.from("entries").insert(toDb(entry));
    pollTeam();
  };
  const deleteEntry=async(id)=>{
    setEntries(prev=>prev.filter(e=>e.id!==id));
    await supabase.from("entries").delete().eq("id",id);
  };
  const updateEntry=async(upd)=>{
    setEntries(prev=>prev.map(e=>e.id===upd.id?upd:e));
    await supabase.from("entries").update(toDb({description:upd.description,projectId:upd.projectId})).eq("id",upd.id);
  };

  // ── Project CRUD (shared — all teammates see changes instantly via realtime)
  const addProject=async(proj)=>{
    setProjects(prev=>[...prev,proj]);
    await supabase.from("projects").insert(toDb(proj));
  };
  const deleteProject=async(id)=>{
    setProjects(prev=>prev.filter(p=>p.id!==id));
    await supabase.from("projects").delete().eq("id",id);
  };

  const getProject=id=>projects.find(p=>p.id===id)||null;

  // ── Header stats
  const todaySec=entries.filter(e=>dayKey(e.startTime)===dayKey(Date.now())).reduce((s,e)=>s+e.duration,0);
  const ws=weekStart(0),we=new Date(ws); we.setDate(ws.getDate()+7);
  const weekSec=entries.filter(e=>{const d=new Date(e.startTime);return d>=ws&&d<we;}).reduce((s,e)=>s+e.duration,0);
  const otherActive=activeUsers.filter(a=>a.userId!==user?.id).length;

  // ── Render gates
  if(!userReady) return <Splash text="Loading…"/>;
  if(!user) return <UserSetup onDone={u=>setUser(u)}/>;
  if(error) return <Splash text={error} isError/>;

  const TABS=["timer","log","projects","reports","team"];

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:C.sans,color:C.t1}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0b0e14}::-webkit-scrollbar-thumb{background:#1a2236;border-radius:2px}
        input,select,button{outline:none}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.12}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Header */}
      <header style={{borderBottom:`1px solid ${C.b1}`,padding:"0 24px",display:"flex",alignItems:"center",gap:20,height:50,position:"sticky",top:0,background:"rgba(11,14,20,0.97)",backdropFilter:"blur(8px)",zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8,userSelect:"none",flexShrink:0}}>
          <div style={{width:26,height:26,borderRadius:6,background:`linear-gradient(135deg,${C.amber},#ef4444)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14.5"/></svg>
          </div>
          <span style={{fontWeight:700,fontSize:15,letterSpacing:"-0.02em"}}>Zeitwerk</span>
        </div>
        <nav style={{display:"flex",gap:2}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"5px 13px",borderRadius:6,border:"none",fontSize:12,fontWeight:500,background:tab===t?C.card:"transparent",color:tab===t?C.amber:C.t3,textTransform:"capitalize",transition:"all 0.15s",fontFamily:C.sans,cursor:"pointer"}}>
              {t}{t==="team"&&otherActive>0&&<span style={{marginLeft:4,background:C.green,color:"#041a10",borderRadius:5,fontSize:9,padding:"1px 5px",fontWeight:700,verticalAlign:"middle"}}>{otherActive}</span>}
            </button>
          ))}
        </nav>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:16}}>
          {loading&&<Spinner/>}
          {running&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.amber}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.red,animation:"pulse 1.2s infinite"}}/>
            <span style={{fontFamily:C.mono,fontWeight:700}}>{fmtDur(elapsed)}</span>
          </div>}
          <div style={{fontSize:11,color:C.t3,display:"flex",gap:12}}>
            <span>Today&nbsp;<span style={{color:C.t2,fontFamily:C.mono}}>{fmtHM(todaySec+(running?elapsed:0))}</span></span>
            <span>Week&nbsp;<span style={{color:C.t2,fontFamily:C.mono}}>{fmtHM(weekSec+(running?elapsed:0))}</span></span>
          </div>
          <Avatar name={user.name} color={user.color} size={26}/>
        </div>
      </header>

      <main style={{padding:"28px 24px",maxWidth:900,margin:"0 auto",animation:"fadeIn 0.2s ease"}}>
        {tab==="timer"    &&<TimerTab    {...{timerDesc,setTimerDesc,timerProject,setTimerProject,running,elapsed,startTimer,stopTimer,entries,projects,getProject,deleteEntry,updateEntry}}/>}
        {tab==="log"      &&<LogTab      {...{user,entries,projects,getProject,deleteEntry,updateEntry,addEntry}}/>}
        {tab==="projects" &&<ProjectsTab {...{projects,addProject,deleteProject,entries}}/>}
        {tab==="reports"  &&<ReportsTab  {...{entries,projects}}/>}
        {tab==="team"     &&<TeamTab     {...{currentUser:user,activeUsers,teamEntries,projects,getProject,lastRefresh,refreshing}}/>}
      </main>
    </div>
  );
}

function Splash({text,isError=false}){
  return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,color:isError?C.red:C.t3,fontFamily:C.sans,fontSize:13,textAlign:"center",padding:24}}>{text}</div>;
}
