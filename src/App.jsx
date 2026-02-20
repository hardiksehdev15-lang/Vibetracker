import { supabase } from "./supabaseClient";
import { useState, useEffect, useRef } from "react";

/* ─── Types ──────────────────────────────────────────────────────────────── */
const TASKS_INIT = [
  { id:"t1", title:"Build auth flow",         hours:3.0, status:"inprogress", overdue:true,  projectId:"p1" },
  { id:"t2", title:"Design Today view",       hours:2.0, status:"todo",       overdue:false, projectId:"p1" },
  { id:"t3", title:"Write DB schema",         hours:1.5, status:"done",       overdue:false, projectId:"p1" },
  { id:"t4", title:"Setup Express + Postgres",hours:1.0, status:"done",       overdue:false, projectId:"p1" },
  { id:"t5", title:"Daily check-in endpoint", hours:2.5, status:"todo",       overdue:false, projectId:"p1" },
  { id:"t6", title:"Gamification logic",      hours:3.0, status:"todo",       overdue:true,  projectId:"p1" },
];

const PROJECT_INIT = {
  id:"p1", title:"Launch MVP", deadline:"2025-03-01",
  progress:42, daysLeft:39, requiredPace:2.4, isBehind:false
};

const GAMI_INIT = { streak:12, points:3240, level:3, multiplier:1.35, longestStreak:18 };

const LEVEL_NAMES = ["","Rookie","Builder","Hustler","Veteran","Legend"];
const LEVEL_XP    = [0, 500, 1500, 3500, 7500, 99999];

/* ─── Micro Confetti ─────────────────────────────────────────────────────── */
function useConfetti() {
  const [particles, setParticles] = useState([]);
  const fire = () => {
    const ps = Array.from({length:50},(_,i)=>({
      id:i, x:30+Math.random()*40, vx:(Math.random()-0.5)*6,
      vy:-(4+Math.random()*6), ay:0.3,
      color:["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#a855f7"][i%6],
      size:5+Math.random()*6, rot:Math.random()*360, drot:(Math.random()-0.5)*15,
    }));
    setParticles(ps);
    setTimeout(()=>setParticles([]), 3500);
  };
  return { particles, fire };
}

function ConfettiLayer({ particles }) {
  const [pos, setPos] = useState(particles.map(p=>({...p})));
  const raf = useRef(null);
  useEffect(()=>{
    if (!particles.length) { setPos([]); return; }
    setPos(particles.map(p=>({...p,y:-20})));
  },[particles]);
  useEffect(()=>{
    if (!pos.length) return;
    const animate = () => {
      setPos(prev=>prev.map(p=>({
        ...p, y:p.y+p.vy, vy:p.vy+p.ay, x:p.x+p.vx/10, rot:p.rot+p.drot
      })).filter(p=>p.y<110));
      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return ()=>cancelAnimationFrame(raf.current);
  },[pos.length > 0]);
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      {pos.map(p=>(
        <div key={p.id} style={{
          position:"absolute", left:`${p.x}%`, top:`${p.y}%`,
          width:p.size, height:p.size, background:p.color,
          transform:`rotate(${p.rot}deg)`,
          borderRadius: p.id%3===0 ? "50%" : p.id%3===1 ? "2px" : "0",
          opacity: p.y > 80 ? (110-p.y)/30 : 1,
        }}/>
      ))}
    </div>
  );
}

/* ─── Shared UI ──────────────────────────────────────────────────────────── */
function Bar({ value, color="#ef4444", bg="#1c1c1c", h=6, className="" }) {
  return (
    <div style={{height:h,background:bg,borderRadius:h}} className={`overflow-hidden ${className}`}>
      <div style={{width:`${Math.min(100,value)}%`,height:"100%",background:color,
        borderRadius:h,transition:"width 1s cubic-bezier(.4,0,.2,1)"}}/>
    </div>
  );
}

function Tag({ children, color="#ef4444" }) {
  return (
    <span style={{background:`${color}22`,color,border:`1px solid ${color}44`,
      fontSize:10,fontWeight:700,letterSpacing:1,padding:"2px 8px",borderRadius:4,
      textTransform:"uppercase",fontFamily:"monospace"}}>
      {children}
    </span>
  );
}

/* ─── Nav ────────────────────────────────────────────────────────────────── */
function Nav({ tab, setTab, project }) {
  const tabs = [
    {id:"today",   icon:"▣", label:"Today"},
    {id:"timeline",icon:"═", label:"Timeline"},
    {id:"analytics",icon:"◈",label:"Stats"},
    {id:"settings",icon:"◎", label:"Settings"},
  ];
  return (
    <nav style={{background:"#0d0d0d",borderBottom:"1px solid #1e1e1e",
      position:"sticky",top:0,zIndex:50,
      display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"0 20px",height:52}}>
      {/* Logo */}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:28,height:28,background:"#ef4444",display:"flex",
          alignItems:"center",justifyContent:"center",
          fontWeight:900,fontSize:14,color:"#fff",letterSpacing:-1,
          clipPath:"polygon(0 0,100% 0,100% 75%,75% 100%,0 100%)"}}>V</div>
        <span style={{fontFamily:"'Courier New',monospace",fontWeight:700,
          fontSize:13,color:"#fff",letterSpacing:2,textTransform:"uppercase"}}>VibeTrack</span>
        <span style={{color:"#333",margin:"0 6px"}}>|</span>
        <span style={{fontFamily:"'Courier New',monospace",fontSize:12,color:"#666"}}>
          {project.title}
        </span>
      </div>
      {/* Tabs */}
      <div style={{display:"flex",gap:2}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            background:tab===t.id?"#ef4444":"transparent",
            color:tab===t.id?"#fff":"#555",
            border:"none",cursor:"pointer",
            padding:"6px 14px",borderRadius:4,
            fontFamily:"'Courier New',monospace",fontSize:11,
            fontWeight:700,letterSpacing:1,textTransform:"uppercase",
            transition:"all .15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ─── Task Row ───────────────────────────────────────────────────────────── */
function TaskRow({ task, onToggle }) {
  const done = task.status === "done";
  return (
    <div onClick={()=>onToggle(task.id)} style={{
      display:"flex",alignItems:"center",gap:10,
      padding:"10px 14px",
      background: done ? "#111" : task.overdue ? "#1a0a0a" : "#111",
      border: `1px solid ${done ? "#1c1c1c" : task.overdue ? "#3a1010" : "#1e1e1e"}`,
      borderRadius:6,cursor:"pointer",transition:"all .1s",marginBottom:4,
    }}>
      {/* Checkbox */}
      <div style={{
        width:16,height:16,borderRadius:3,flexShrink:0,
        background: done ? "#ef4444" : "transparent",
        border: `2px solid ${done ? "#ef4444" : task.overdue ? "#7f1d1d" : "#333"}`,
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>
        {done && <span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
      </div>
      <span style={{
        flex:1,fontFamily:"'Courier New',monospace",fontSize:12,
        color: done ? "#444" : "#ccc",
        textDecoration: done ? "line-through" : "none",
      }}>{task.title}</span>
      {task.overdue && !done && <Tag color="#ef4444">OVERDUE</Tag>}
      <span style={{fontFamily:"monospace",fontSize:11,color:"#555",flexShrink:0}}>
        {task.hours}h
      </span>
    </div>
  );
}

/* ─── Check-in Panel ─────────────────────────────────────────────────────── */
function CheckinPanel({ done, result, onSubmit }) {
  const [sel, setSel] = useState(null);
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (sel===null) return;
    setLoading(true);
    await new Promise(r=>setTimeout(r,900));
    onSubmit({ completed_percent:sel, time_spent_hours:parseFloat(hours)||0, notes });
    setLoading(false);
  }

  if (done && result) return (
    <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:24,textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:8}}>
        {result.gamification.show_celebration ? "🎯" : "📋"}
      </div>
      <p style={{fontFamily:"monospace",fontWeight:700,color:"#ef4444",letterSpacing:2,
        textTransform:"uppercase",fontSize:12,marginBottom:16}}>
        {result.gamification.show_celebration ? "// TARGET HIT" : "// LOGGED"}
      </p>
      {[
        ["PROGRESS",    `${result.metrics.progress_percent}%`],
        ["VELOCITY",    `${result.metrics.velocity_7d}h/day`],
        ["PROJECTED",   result.metrics.projected_completion],
        ["TIME SAVED",  `${result.metrics.time_saved_hours}h`],
        ["PTS EARNED",  `+${result.gamification.points_earned}`],
        ["MULTIPLIER",  `${result.gamification.multiplier.toFixed(2)}×`],
      ].map(([k,v])=>(
        <div key={k} style={{display:"flex",justifyContent:"space-between",
          padding:"7px 12px",background:"#0d0d0d",borderRadius:4,marginBottom:4}}>
          <span style={{fontFamily:"monospace",fontSize:10,color:"#555",letterSpacing:1}}>{k}</span>
          <span style={{fontFamily:"monospace",fontSize:11,color:"#ccc",fontWeight:700}}>{v}</span>
        </div>
      ))}
      {result.gamification.new_badges.length > 0 && (
        <div style={{marginTop:12,padding:"10px 14px",background:"#1a0a0a",
          border:"1px solid #7f1d1d",borderRadius:6}}>
          <span style={{fontSize:18}}>🏅</span>
          <span style={{fontFamily:"monospace",fontSize:11,color:"#ef4444",marginLeft:8}}>
            BADGE UNLOCKED: {result.gamification.new_badges[0].name}
          </span>
        </div>
      )}
    </div>
  );

  const opts = [
    {val:100,label:"DONE",sub:"≥80% required",color:"#22c55e"},
    {val:50, label:"HALF",sub:"streak penalty",color:"#f97316"},
    {val:0,  label:"SKIP",sub:"streak RESET",color:"#ef4444"},
  ];

  return (
    <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:20}}>
      <p style={{fontFamily:"monospace",fontWeight:700,color:"#555",letterSpacing:2,
        textTransform:"uppercase",fontSize:10,marginBottom:16}}>// DAILY CHECK-IN</p>

      <p style={{fontFamily:"monospace",fontSize:13,color:"#bbb",marginBottom:14}}>
        Did you hit today's targets?
      </p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:18}}>
        {opts.map(o=>(
          <button key={o.val} onClick={()=>setSel(o.val)} style={{
            padding:"14px 8px",borderRadius:6,cursor:"pointer",
            background: sel===o.val ? `${o.color}22` : "#0d0d0d",
            border: `2px solid ${sel===o.val ? o.color : "#1e1e1e"}`,
            transition:"all .15s",textAlign:"center",
          }}>
            <div style={{fontFamily:"monospace",fontWeight:900,fontSize:14,
              color:sel===o.val ? o.color : "#444",letterSpacing:1}}>{o.label}</div>
            <div style={{fontFamily:"monospace",fontSize:9,color:"#444",marginTop:3,
              letterSpacing:0.5}}>{o.sub}</div>
          </button>
        ))}
      </div>

      {/* Strict mode warning */}
      {sel===0 && (
        <div style={{padding:"8px 12px",background:"#1a0505",border:"1px solid #7f1d1d",
          borderRadius:6,marginBottom:14}}>
          <span style={{fontFamily:"monospace",fontSize:11,color:"#ef4444",letterSpacing:1}}>
            ⚠ STRICT MODE: Streak resets to 0, multiplier –0.10
          </span>
        </div>
      )}
      {sel===50 && (
        <div style={{padding:"8px 12px",background:"#1a0f05",border:"1px solid #92400e",
          borderRadius:6,marginBottom:14}}>
          <span style={{fontFamily:"monospace",fontSize:11,color:"#f97316",letterSpacing:1}}>
            ⚠ STRICT MODE: No streak increment, 50% point penalty
          </span>
        </div>
      )}

      <div style={{display:"grid",gap:10,marginBottom:14}}>
        <div>
          <label style={{fontFamily:"monospace",fontSize:10,color:"#555",letterSpacing:1,
            textTransform:"uppercase",display:"block",marginBottom:5}}>Hours worked</label>
          <input type="number" min="0" max="24" step="0.5"
            value={hours} onChange={e=>setHours(e.target.value)}
            placeholder="0.0"
            style={{width:"100%",background:"#0d0d0d",border:"1px solid #1e1e1e",
              borderRadius:5,padding:"9px 12px",color:"#ccc",fontFamily:"monospace",
              fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div>
          <label style={{fontFamily:"monospace",fontSize:10,color:"#555",letterSpacing:1,
            textTransform:"uppercase",display:"block",marginBottom:5}}>Notes</label>
          <textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder="what shipped today?"
            style={{width:"100%",background:"#0d0d0d",border:"1px solid #1e1e1e",
              borderRadius:5,padding:"9px 12px",color:"#ccc",fontFamily:"monospace",
              fontSize:12,outline:"none",resize:"none",boxSizing:"border-box"}}/>
        </div>
      </div>

      <button onClick={submit} disabled={sel===null||loading} style={{
        width:"100%",padding:"12px 0",borderRadius:6,cursor:sel===null?"not-allowed":"pointer",
        background: sel===null ? "#1a1a1a" : "#ef4444",
        border: "none",
        color: sel===null ? "#444" : "#fff",
        fontFamily:"monospace",fontWeight:900,fontSize:13,letterSpacing:2,
        textTransform:"uppercase",transition:"all .15s",
        opacity: sel===null ? 0.5 : 1,
      }}>
        {loading ? "PROCESSING..." : sel===null ? "SELECT STATUS ↑" : "SUBMIT CHECK-IN //"}
      </button>
    </div>
  );
}

/* ─── Momentum Panel ─────────────────────────────────────────────────────── */
function MomentumPanel({ gami, project, result }) {
  const g = result?.gamification
    ? { ...gami, streak: result.gamification.streak_count,
        points: result.gamification.points_total,
        multiplier: result.gamification.multiplier }
    : gami;

  const lvl = g.level;
  const xpMin = LEVEL_XP[lvl-1];
  const xpMax = LEVEL_XP[lvl];
  const xpPct = Math.min(100, ((g.points - xpMin) / (xpMax - xpMin)) * 100);
  const lvlColor = ["","#6b7280","#3b82f6","#22c55e","#eab308","#a855f7"][lvl];

  return (
    <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:20,
      display:"flex",flexDirection:"column",gap:16}}>

      {/* Streak */}
      <div style={{textAlign:"center",padding:"16px 0",
        borderBottom:"1px solid #1e1e1e"}}>
        <div style={{fontSize:36, filter: g.streak>0 ? "drop-shadow(0 0 14px #ef4444aa)" : "none"}}>
          {g.streak > 0 ? "🔥" : "💀"}
        </div>
        <div style={{fontFamily:"monospace",fontWeight:900,fontSize:36,
          color: g.streak>0?"#ef4444":"#333",lineHeight:1.1,marginTop:4}}>
          {g.streak}
        </div>
        <div style={{fontFamily:"monospace",fontSize:10,color:"#444",
          letterSpacing:2,textTransform:"uppercase",marginTop:2}}>
          {g.streak===0?"STREAK DEAD":"DAY STREAK"}
        </div>
        {g.streak > 0 && g.streak < g.longestStreak && (
          <div style={{fontFamily:"monospace",fontSize:9,color:"#555",marginTop:4}}>
            best: {g.longestStreak}
          </div>
        )}
      </div>

      {/* Level + XP */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:6}}>
          <span style={{fontFamily:"monospace",fontWeight:700,fontSize:12,color:lvlColor,
            letterSpacing:1}}>LV.{lvl} {LEVEL_NAMES[lvl]}</span>
          <span style={{fontFamily:"monospace",fontSize:10,color:"#555"}}>
            {g.points.toLocaleString()} pts
          </span>
        </div>
        <Bar value={xpPct} color={lvlColor} h={5}/>
        <div style={{fontFamily:"monospace",fontSize:9,color:"#444",marginTop:4,textAlign:"right"}}>
          {(xpMax - g.points).toLocaleString()} to LV.{lvl+1}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[
          {k:"MULTIPLIER",v:`${g.multiplier.toFixed(2)}×`,color: g.multiplier>=1?"#22c55e":"#ef4444"},
          {k:"PACE NEEDED",v:`${project.requiredPace}h/day`,color:"#fff"},
        ].map(({k,v,color})=>(
          <div key={k} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",
            borderRadius:6,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontFamily:"monospace",fontWeight:900,fontSize:16,color}}>{v}</div>
            <div style={{fontFamily:"monospace",fontSize:9,color:"#444",
              letterSpacing:1,textTransform:"uppercase",marginTop:2}}>{k}</div>
          </div>
        ))}
      </div>

      {/* Time-saved callout */}
      <div style={{background:"#0d0d0d",border:"1px solid #2a1010",borderRadius:6,
        padding:"12px 14px"}}>
        <div style={{fontFamily:"monospace",fontSize:9,color:"#ef4444",
          letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>⚡ FINISH EARLY → SAVE</div>
        <div style={{fontFamily:"monospace",fontWeight:900,fontSize:22,color:"#fff"}}>
          12 hours
        </div>
        <div style={{fontFamily:"monospace",fontSize:10,color:"#555",marginTop:2}}>
          of deadline crunch
        </div>
      </div>

      {/* Next badge */}
      <div style={{border:"1px solid #1a1a1a",borderRadius:6,padding:"10px 14px",
        display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:22,opacity:0.3}}>🏅</span>
        <div>
          <div style={{fontFamily:"monospace",fontSize:11,color:"#777",fontWeight:700}}>
            7-Day Warrior
          </div>
          <div style={{fontFamily:"monospace",fontSize:9,color:"#444",marginTop:2}}>
            {Math.max(0,7-g.streak)} more days needed
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Analytics Tab ──────────────────────────────────────────────────────── */
function AnalyticsTab({ project }) {
  const velocityData = [1.5,2.8,0,3.5,4.1,2.2,3.6];
  const burndown = [100,94,88,80,75,65,58,49,42];
  const days = ["Jan 1","Jan 5","Jan 10","Jan 15","Jan 20","Jan 25","Feb 1","Feb 5","Today"];

  return (
    <div style={{display:"grid",gap:16}}>
      {/* KPI row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[
          {label:"PROGRESS",  value:"42%",     sub:"of total work done",color:"#ef4444"},
          {label:"VELOCITY",  value:"3.2h/day", sub:"7-day rolling avg", color:"#3b82f6"},
          {label:"PROJECTED", value:"Feb 22",   sub:"vs Mar 1 deadline", color:"#22c55e"},
          {label:"TIME SAVED",value:"16.8h",    sub:"vs original plan",  color:"#a855f7"},
        ].map(m=>(
          <div key={m.label} style={{background:"#111",border:"1px solid #1e1e1e",
            borderRadius:8,padding:"14px 16px"}}>
            <div style={{fontFamily:"monospace",fontSize:9,color:"#555",letterSpacing:2,
              textTransform:"uppercase",marginBottom:8}}>{m.label}</div>
            <div style={{fontFamily:"monospace",fontWeight:900,fontSize:22,color:m.color}}>
              {m.value}</div>
            <div style={{fontFamily:"monospace",fontSize:9,color:"#444",marginTop:4}}>
              {m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {/* Burndown */}
        <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:20}}>
          <div style={{fontFamily:"monospace",fontSize:10,color:"#555",letterSpacing:2,
            textTransform:"uppercase",marginBottom:16}}>// BURNDOWN</div>
          <svg viewBox="0 0 280 100" style={{width:"100%",height:120}}>
            {/* Grid */}
            {[0,25,50,75,100].map(v=>(
              <line key={v} x1="24" y1={100-v} x2="276" y2={100-v}
                stroke="#1a1a1a" strokeWidth="1"/>
            ))}
            {/* Ideal line */}
            <line x1="24" y1="0" x2="276" y2="100"
              stroke="#2a2a2a" strokeWidth="1.5" strokeDasharray="6,4"/>
            {/* Actual */}
            <polyline
              points={burndown.map((v,i)=>`${24+(i/(burndown.length-1))*252},${100-v}`).join(" ")}
              fill="none" stroke="#ef4444" strokeWidth="2.5"
              strokeLinejoin="round" strokeLinecap="round"/>
            {/* Dots */}
            {burndown.map((v,i)=>(
              <circle key={i}
                cx={24+(i/(burndown.length-1))*252} cy={100-v}
                r={i===burndown.length-1?4:2.5}
                fill={i===burndown.length-1?"#ef4444":"#7f1d1d"}/>
            ))}
            {/* Y labels */}
            {[0,50,100].map(v=>(
              <text key={v} x="20" y={100-v+4} textAnchor="end"
                fill="#444" fontSize="8" fontFamily="monospace">{v}%</text>
            ))}
          </svg>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            {["Jan 1","","","","","","","","Today"].map((d,i)=>(
              <span key={i} style={{fontFamily:"monospace",fontSize:8,color:"#444"}}>{d}</span>
            ))}
          </div>
        </div>

        {/* Velocity bars */}
        <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:20}}>
          <div style={{fontFamily:"monospace",fontSize:10,color:"#555",letterSpacing:2,
            textTransform:"uppercase",marginBottom:16}}>// VELOCITY (7-DAY)</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100}}>
            {velocityData.map((v,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",
                alignItems:"center",gap:4}}>
                <span style={{fontFamily:"monospace",fontSize:8,color:"#555"}}>{v}h</span>
                <div style={{
                  width:"100%",borderRadius:"3px 3px 0 0",
                  height:Math.max(4,(v/5)*72),
                  background: v===0 ? "#1a1a1a" : i===velocityData.length-1 ? "#ef4444" : "#3b82f6",
                  transition:"height .8s",
                }}/>
                <span style={{fontFamily:"monospace",fontSize:8,color:"#444"}}>
                  {["M","T","W","T","F","S","S"][i]}
                </span>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,padding:"8px 12px",background:"#0d0d0d",
            borderRadius:4,border:"1px solid #1a1a1a"}}>
            <span style={{fontFamily:"monospace",fontSize:10,color:"#ef4444",marginRight:8}}>
              ⚡ AVG
            </span>
            <span style={{fontFamily:"monospace",fontSize:11,color:"#ccc",fontWeight:700}}>
              3.2h/day
            </span>
            <span style={{fontFamily:"monospace",fontSize:9,color:"#555",marginLeft:8}}>
              (excl. missed days)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Timeline Tab ───────────────────────────────────────────────────────── */
function TimelineTab() {
  const tracks = [
    {label:"Auth & DB",       start:0,  w:22, done:0.9, color:"#3b82f6"},
    {label:"Core UI",         start:18, w:26, done:0.35,color:"#ef4444"},
    {label:"Check-in Flow",   start:30, w:20, done:0.1, color:"#f97316"},
    {label:"Analytics",       start:42, w:22, done:0,   color:"#22c55e"},
    {label:"Gamification",    start:55, w:20, done:0,   color:"#a855f7"},
    {label:"Deploy & QA",     start:68, w:16, done:0,   color:"#eab308"},
  ];
  return (
    <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:24}}>
      <div style={{fontFamily:"monospace",fontSize:10,color:"#555",letterSpacing:2,
        textTransform:"uppercase",marginBottom:20}}>// PROJECT TIMELINE — JAN → MAR 2025</div>

      {/* Month labels */}
      <div style={{display:"flex",marginLeft:140,marginBottom:10}}>
        {["JANUARY","FEBRUARY","MARCH"].map(m=>(
          <div key={m} style={{flex:1,fontFamily:"monospace",fontSize:9,color:"#444",
            letterSpacing:2,textAlign:"center"}}>{m}</div>
        ))}
      </div>

      {/* Rows */}
      {tracks.map(t=>(
        <div key={t.label} style={{display:"flex",alignItems:"center",
          gap:10,marginBottom:8}}>
          <div style={{width:130,fontFamily:"monospace",fontSize:11,color:"#666",
            textAlign:"right",flexShrink:0}}>{t.label}</div>
          <div style={{flex:1,height:22,background:"#0d0d0d",
            borderRadius:3,position:"relative",overflow:"hidden"}}>
            {/* Track bg */}
            <div style={{position:"absolute",left:`${t.start}%`,width:`${t.w}%`,
              height:"100%",background:`${t.color}22`,borderRadius:3,
              border:`1px solid ${t.color}33`}}/>
            {/* Progress */}
            <div style={{position:"absolute",left:`${t.start}%`,
              width:`${t.w * t.done}%`,height:"100%",background:t.color,
              borderRadius:3,opacity:0.85,transition:"width 1s"}}/>
            {/* % label */}
            {t.done > 0 && (
              <span style={{position:"absolute",left:`${t.start+1}%`,top:"50%",
                transform:"translateY(-50%)",fontFamily:"monospace",fontSize:9,
                color:"#fff",fontWeight:700}}>{Math.round(t.done*100)}%</span>
            )}
          </div>
          <div style={{width:32,fontFamily:"monospace",fontSize:9,color:"#444",
            flexShrink:0,textAlign:"right"}}>{Math.round(t.done*100)}%</div>
        </div>
      ))}

      {/* Deadline line */}
      <div style={{position:"relative",marginLeft:150,marginTop:8}}>
        <div style={{position:"absolute",left:"81.5%",top:-145,height:155,
          borderLeft:"1.5px dashed #ef4444",opacity:0.6}}/>
        <span style={{position:"absolute",left:"82%",top:-152,
          fontFamily:"monospace",fontSize:9,color:"#ef4444",
          background:"#111",padding:"2px 4px",letterSpacing:1}}>
          ◆ MAR 1
        </span>
      </div>
    </div>
  );
}

/* ─── Settings Tab ───────────────────────────────────────────────────────── */
function SettingsTab() {
  const [intensity, setIntensity] = useState("strict");
  const modes = [
    {id:"gentle",label:"GENTLE",desc:"No penalties for missed days. Encouragement only.",color:"#22c55e"},
    {id:"normal",label:"NORMAL",desc:"Miss = –10% points, streak paused (not reset).",color:"#3b82f6"},
    {id:"strict",label:"STRICT",desc:"Miss = streak RESET, –multiplier, 0 pts. No mercy.",color:"#ef4444"},
  ];
  return (
    <div style={{maxWidth:480}}>
      <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:24,
        marginBottom:16}}>
        <div style={{fontFamily:"monospace",fontSize:10,color:"#555",letterSpacing:2,
          textTransform:"uppercase",marginBottom:16}}>// INTENSITY MODE</div>
        {modes.map(m=>(
          <div key={m.id} onClick={()=>setIntensity(m.id)} style={{
            padding:"14px 16px",borderRadius:6,marginBottom:8,cursor:"pointer",
            background: intensity===m.id ? `${m.color}11` : "#0d0d0d",
            border: `1px solid ${intensity===m.id ? m.color : "#1a1a1a"}`,
            transition:"all .15s",
          }}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <div style={{width:8,height:8,borderRadius:"50%",
                background:intensity===m.id?m.color:"#333",flexShrink:0}}/>
              <span style={{fontFamily:"monospace",fontWeight:900,fontSize:12,
                color:intensity===m.id?m.color:"#555",letterSpacing:2}}>{m.label}</span>
              {m.id==="strict" && <Tag color="#ef4444">DEFAULT</Tag>}
            </div>
            <p style={{fontFamily:"monospace",fontSize:11,color:"#555",
              margin:0,paddingLeft:18}}>{m.desc}</p>
          </div>
        ))}
      </div>

      <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:24}}>
        <div style={{fontFamily:"monospace",fontSize:10,color:"#555",letterSpacing:2,
          textTransform:"uppercase",marginBottom:16}}>// NOTIFICATIONS</div>
        {[
          {label:"Daily reminder",    sub:"9:00 AM — check-in prompt"},
          {label:"Missed check-in",   sub:"If no check-in by 10 PM"},
          {label:"Weekly report",     sub:"Sunday 8 AM summary"},
          {label:"Streak milestone",  sub:"7, 30, 100 day achievements"},
        ].map(n=>(
          <div key={n.label} style={{display:"flex",alignItems:"center",
            justifyContent:"space-between",padding:"10px 0",
            borderBottom:"1px solid #1a1a1a"}}>
            <div>
              <div style={{fontFamily:"monospace",fontSize:12,color:"#ccc"}}>{n.label}</div>
              <div style={{fontFamily:"monospace",fontSize:10,color:"#444",marginTop:2}}>{n.sub}</div>
            </div>
            <div style={{width:36,height:20,background:"#ef4444",borderRadius:10,
              position:"relative",cursor:"pointer",flexShrink:0}}>
              <div style={{position:"absolute",right:2,top:2,width:16,height:16,
                background:"#fff",borderRadius:"50%"}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState("today");
  const [tasks, setTasks] = useState([]); 
  const [project, setProject] = useState(PROJECT_INIT);
  const [gami, setGami] = useState(GAMI_INIT);
  const [checkinDone, setCheckinDone] = useState(false);
  const [checkinResult, setCheckinResult] = useState(null);
  const { particles, fire } = useConfetti();

  // Load all data from Supabase on startup
  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    // 1. Fetch Tasks
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });
    if (tasksData) setTasks(tasksData);

    // 2. Fetch Project Info
    const { data: projData } = await supabase
      .from('projects')
      .select('*')
      .limit(1)
      .single();
    if (projData) setProject(prev => ({ ...prev, title: projData.title, requiredPace: projData.required_pace }));

    // 3. Fetch Gamification Stats
    const { data: statsData } = await supabase
      .from('daily_stats')
      .select('*')
      .limit(1)
      .single();
    if (statsData) setGami(prev => ({ 
      ...prev, 
      streak: statsData.streak, 
      points: statsData.points, 
      multiplier: statsData.multiplier 
    }));
  }

  const totalHrs = tasks.reduce((s,t)=>s+t.hours,0);
  const doneHrs  = tasks.filter(t=>t.status==="done").reduce((s,t)=>s+t.hours,0);

  // Function to toggle task status
  async function toggleTask(id) {
    const taskToToggle = tasks.find(t => t.id === id);
    const newStatus = taskToToggle.status === "done" ? "todo" : "done";

    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) console.error("Sync failed:", error);
  }

  // Function to add a new task
  async function addNewTask() {
    const title = prompt("Enter task title:", "New Task");
    if (!title) return;

    const newTask = {
      title: title,
      hours: 1.0,
      status: "todo",
  
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert([newTask])
      .select();

    if (error) {
      console.error("Error adding task:", error);
      alert("Error adding task: " + error.message);
    } else if (data) {
      setTasks(prev => [...prev, data[0]]);
    }
  }

  function handleCheckin({ completed_percent, time_spent_hours }) {
    const strict_threshold = 80;
    const meets = completed_percent >= strict_threshold;
    const newStreak = meets ? gami.streak + 1 : 0;
    let newMult = gami.multiplier;
    if (!meets) newMult = Math.max(0.5, newMult - 0.1);
    else if (completed_percent === 100) newMult = Math.min(2.0, newMult + 0.05);

    const basePoints = meets ? (completed_percent===100 ? 70 : 50) : 0;
    const earned = Math.round(basePoints * newMult);
    const newPoints = gami.points + earned;
    const newLevel = newPoints<500?1:newPoints<1500?2:newPoints<3500?3:newPoints<7500?4:5;
    const newProgress = Math.min(100, project.progress + (completed_percent/100)*6);

    const result = {
      checkin: { date:new Date().toISOString().split("T")[0], completed_percent },
      metrics: {
        progress_percent: Math.round(newProgress*10)/10,
        projected_completion: "2025-02-22",
        velocity_7d: 3.6,
        time_saved_hours: meets ? 16.8 : 0,
        required_daily_pace_hours: 2.0,
      },
      gamification: {
        show_celebration: meets,
        streak_count: newStreak,
        points_earned: earned,
        points_total: newPoints,
        level: newLevel,
        multiplier: newMult,
        new_badges: newStreak===7 ? [{id:"streak_7",name:"7-Day Warrior"}] : [],
      },
    };
    setCheckinResult(result);
    setCheckinDone(true);
    setProject(p=>({...p,progress:newProgress}));
    setGami(g=>({...g,streak:newStreak,points:newPoints,level:newLevel,multiplier:newMult}));
    if (meets) fire();
  }

  const today = new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0a",color:"#fff", fontFamily:"'Courier New',Courier,monospace"}}>
      <ConfettiLayer particles={particles}/>
      <Nav tab={tab} setTab={setTab} project={project}/>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"24px 20px"}}>
        {/* Header */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"space-between", alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontFamily:"monospace",fontSize:9,color:"#555", letterSpacing:3,textTransform:"uppercase",marginBottom:6}}>{today}</div>
              <h1 style={{fontFamily:"monospace",fontWeight:900,fontSize:22, color:"#fff",letterSpacing:-0.5,margin:0}}>{project.title}</h1>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"monospace",fontWeight:900,fontSize:32, color:"#ef4444",lineHeight:1}}>{project.progress.toFixed(0)}%</div>
              <div style={{fontFamily:"monospace",fontSize:10,color:"#555",marginTop:4}}>
                {project.daysLeft} DAYS LEFT
              </div>
            </div>
          </div>
          <Bar value={project.progress} color="#ef4444" h={4}/>
          {project.isBehind && (
            <div style={{marginTop:10,padding:"8px 14px",background:"#1a0505", border:"1px solid #7f1d1d",borderRadius:5,display:"flex", alignItems:"center",gap:8}}>
              <span style={{color:"#ef4444"}}>⚠</span>
              <span style={{fontFamily:"monospace",fontSize:11,color:"#ef4444",letterSpacing:1}}>
                BEHIND PACE — {project.requiredPace}h/day required to hit deadline
              </span>
            </div>
          )}
        </div>

        {/* TODAY TAB */}
        {tab==="today" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
            {/* Tasks Column */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between", alignItems:"center",marginBottom:12}}>
                <span style={{fontFamily:"monospace",fontSize:9,color:"#555", letterSpacing:2,textTransform:"uppercase"}}>// TODAY'S TASKS</span>
                <span style={{fontFamily:"monospace",fontSize:10,color:"#555"}}>
                  {doneHrs.toFixed(1)}/{totalHrs}h
                </span>
              </div>
              
              {tasks.map(t=><TaskRow key={t.id} task={t} onToggle={toggleTask}/>)}
              
              <div 
  onClick={addNewTask}
  style={{
    marginTop: "12px",
    padding: "12px",
    border: "1px dashed #333", 
    borderRadius: "6px",
    cursor: "pointer", 
    textAlign: "center",
    background: "#111",
    display: "block",      // Ensures it takes up space
    position: "relative",  // Brings it to the front
    zIndex: 10             // Makes sure it's on top of other layers
  }}
>
  <span style={{ fontSize: "10px", color: "#aaa" }}>+ ADD TASK</span>
</div>
            </div>

            {/* Check-in Column */}
            <CheckinPanel done={checkinDone} result={checkinResult} onSubmit={handleCheckin}/>

            {/* Momentum Column */}
            <MomentumPanel gami={gami} project={project} result={checkinResult}/>
          </div>
        )}

        {tab==="timeline" && <TimelineTab/>}
        {tab==="analytics" && <AnalyticsTab project={project}/>}
        {tab==="settings" && <SettingsTab/>}
      </div>
    </div>
  );
}