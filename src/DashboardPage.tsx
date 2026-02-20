/**
 * DashboardPage.tsx
 *
 * Vite + React Router DOM — NO Next.js "use client" directives.
 *
 * Fixes applied:
 *  ✅  Auth guard using useNavigate (React Router DOM)
 *  ✅  Task checkboxes with strikethrough + completion
 *  ✅  Progress bar computed from real tasks
 *  ✅  Streak computed live from Supabase data (no hardcoded value)
 *  ✅  Deadline urgency warnings on tasks + "Streak at risk!" panel
 *  ✅  Analytics tab: KPI cards, 14-day velocity chart, heatmap
 *  ✅  Responsive: stacked on mobile, side-by-side on md+
 *  ✅  Realtime Supabase subscription with 5s polling fallback
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import type { Task } from "./lib/supabaseClient";
import { computeStreak, filterCompleted } from "./lib/streak";
import { AddTaskForm } from "./components/AddTaskForm";
import { TaskList } from "./components/TaskList";

// ─── Streak card with animated ring ──────────────────────────────────────────

function StreakPanel({
  streak, loading, totalTasks, completedToday, urgentTasks,
}: {
  streak: number; loading: boolean;
  totalTasks: number; completedToday: number;
  urgentTasks: Task[];
}) {
  const ringGoal = Math.max(7, Math.ceil((streak + 1) / 7) * 7);
  const r = 42, circ = 2 * Math.PI * r;
  const pct = Math.min(1, streak / ringGoal);
  const ringColor = streak === 0 ? "#374151" : streak >= 7 ? "#22c55e" : "#f97316";

  function msg() {
    if (completedToday === 0) return "Complete a task today to keep your streak alive!";
    if (streak === 0) return "Great start! Keep going tomorrow.";
    if (streak < 3)  return "Building momentum — don't stop now.";
    if (streak < 7)  return `${7 - streak} more day${7 - streak !== 1 ? "s" : ""} to your first week badge!`;
    if (streak < 14) return "One full week. You're unstoppable.";
    if (streak < 30) return "Elite consistency. Stay locked in.";
    return "Legendary. You're a machine.";
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Ring card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/8
        bg-white/[0.04] p-5 text-center">
        {streak > 0 && (
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28
            rounded-full blur-3xl"
            style={{ background: streak >= 7 ? "rgba(34,197,94,.1)" : "rgba(249,115,22,.1)" }} />
        )}

        {/* SVG ring */}
        <div className="relative inline-block mb-3">
          <svg width="108" height="108" viewBox="0 0 108 108"
            className="-rotate-90" aria-hidden="true">
            <circle cx="54" cy="54" r={r} fill="none"
              stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
            <circle cx="54" cy="54" r={r} fill="none"
              stroke={ringColor} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct)}
              style={{ transition: "stroke-dashoffset .8s ease, stroke .4s ease" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {loading
              ? <div className="h-7 w-8 animate-pulse rounded bg-white/10" />
              : <>
                  <span className="text-3xl font-black leading-none text-white
                    tabular-nums">{streak}</span>
                  <span className="mt-0.5 text-[10px] uppercase tracking-widest
                    text-white/35">days</span>
                </>
            }
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-1">
          <span>{streak === 0 ? "🌱" : streak >= 30 ? "⚡" : streak >= 7 ? "🔥" : "✨"}</span>
          <h2 className="text-sm font-bold text-white">
            {loading
              ? <span className="inline-block h-4 w-20 animate-pulse rounded bg-white/10" />
              : `${streak}-Day Streak`}
          </h2>
        </div>
        <p className="text-xs text-white/40 leading-relaxed max-w-[170px] mx-auto">
          {loading
            ? <span className="inline-block h-3 w-32 animate-pulse rounded bg-white/10" />
            : msg()}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/8">
          {[
            { label: "Today",  val: completedToday },
            { label: "Total",  val: totalTasks },
          ].map(({ label, val }) => (
            <div key={label} className="text-center">
              <p className="text-xl font-black text-white/90">
                {loading
                  ? <span className="inline-block h-6 w-6 animate-pulse rounded bg-white/10" />
                  : val}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-white/30">{label}</p>
            </div>
          ))}
        </div>

        {/* Next milestone */}
        {!loading && streak > 0 && streak < ringGoal && (
          <p className="mt-3 text-[10px] text-white/25">
            {ringGoal - streak} more day{ringGoal - streak !== 1 ? "s" : ""} → {ringGoal}-day milestone
          </p>
        )}
      </div>

      {/* ── FIX 3: Deadline urgency warning ── */}
      {!loading && urgentTasks.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span>🚨</span>
            <h3 className="text-sm font-bold text-red-400">Streak at risk!</h3>
          </div>
          <p className="text-xs text-red-300/70 mb-3 leading-relaxed">
            {urgentTasks.length} task{urgentTasks.length > 1 ? "s are" : " is"} due very
            soon. Complete {urgentTasks.length > 1 ? "them" : "it"} to protect your streak.
          </p>
          <div className="space-y-1.5">
            {urgentTasks.slice(0, 3).map(t => {
              const urg = urgencyInfo(t.due_date, t.status);
              return (
                <div key={t.id}
                  className="flex items-center justify-between text-xs">
                  <span className="text-white/55 truncate flex-1 mr-2">{t.title}</span>
                  <span className={`flex-shrink-0 font-semibold ${urg.color}`}>
                    {urg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Next badge */}
      {!loading && streak > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3
          flex items-center gap-3">
          <span className="text-2xl opacity-40">🏅</span>
          <div>
            <p className="text-xs font-semibold text-white/60">{ringGoal}-Day Streak</p>
            <p className="text-[10px] text-white/30 mt-0.5">
              {ringGoal - streak} more day{ringGoal - streak !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ tasks }: { tasks: Task[] }) {
  const total    = tasks.length;
  const done     = tasks.filter(t => t.status === "done").length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
  const overdue  = tasks.filter(t =>
    t.due_date && t.status !== "done" &&
    new Date(t.due_date + "T23:59:59Z") < new Date()
  ).length;
  const barColor = pct === 100 ? "#22c55e" : pct > 60 ? "#f97316" : "#ef4444";

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Progress
        </span>
        <span className="text-sm font-bold text-white">{done}/{total} tasks</span>
      </div>
      <div className="h-2 bg-white/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-white/30">{pct}% complete</span>
        {overdue > 0 && (
          <span className="text-[11px] text-red-400 font-medium">
            ⚠ {overdue} overdue
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Urgency helper ───────────────────────────────────────────────────────────

function urgencyInfo(dueDate: string | null, status: string) {
  if (!dueDate || status === "done")
    return { label: "", color: "", urgent: false };
  const diff = Math.ceil(
    (new Date(dueDate + "T23:59:59Z").getTime() - Date.now()) / 86400000
  );
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: "text-red-400",   urgent: true  };
  if (diff === 0) return { label: "Due today!",               color: "text-red-400",   urgent: true  };
  if (diff === 1) return { label: "Due tomorrow",             color: "text-amber-400", urgent: true  };
  if (diff <= 3)  return { label: `${diff}d left`,            color: "text-amber-400", urgent: false };
  return { label: "", color: "", urgent: false };
}

// ─── FIX 4: Analytics tab ─────────────────────────────────────────────────────

function AnalyticsTab({ tasks }: { tasks: Task[] }) {
  // Build 14-day data
  const data = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const count = tasks.filter(
      t => t.status === "done" && t.completed_at?.slice(0, 10) === dateStr
    ).length;
    return {
      date: dateStr,
      count,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  });

  const maxCount   = Math.max(...data.map(d => d.count), 1);
  const totalDone  = data.reduce((s, d) => s + d.count, 0);
  const activeDays = data.filter(d => d.count > 0).length;
  const avgPerDay  = activeDays > 0 ? (totalDone / activeDays).toFixed(1) : "0";
  const peakDay    = [...data].sort((a, b) => b.count - a.count)[0];
  const streak     = computeStreak(filterCompleted(tasks));

  // SVG line chart
  const W = 560, H = 100, PAD = 8;
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - 2 * PAD);
    const y = H - PAD - (d.count / maxCount) * (H - 2 * PAD);
    return { x, y, ...d };
  });
  const linePath = `M ${pts.map(p => `${p.x},${p.y}`).join(" L ")}`;
  const fillPath = `M ${pts[0].x},${pts[0].y} ${pts.map(p => `L ${p.x},${p.y}`).join(" ")} L ${pts[pts.length-1].x},${H-PAD} L ${pts[0].x},${H-PAD} Z`;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Streak",    value: `${streak}d`,           color: streak > 0 ? "text-orange-400" : "text-white/30" },
          { label: "Avg/day",   value: `${avgPerDay}`,          color: "text-blue-400"    },
          { label: "Peak day",  value: peakDay.count > 0 ? `${peakDay.count} tasks` : "—", color: "text-emerald-400" },
          { label: "Completed", value: tasks.filter(t => t.status === "done").length, color: "text-white" },
        ].map(k => (
          <div key={k.label}
            className="rounded-xl border border-white/8 bg-white/[0.04] p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1">{k.label}</p>
            <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
            {k.label === "Peak day" && peakDay.count > 0 && (
              <p className="text-[10px] text-white/20 mt-0.5">{peakDay.label}</p>
            )}
          </div>
        ))}
      </div>

      {/* Line chart */}
      <div className="rounded-xl border border-white/8 bg-white/[0.04] p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Daily Performance</h3>
            <p className="text-xs text-white/35 mt-0.5">Tasks completed · last 14 days</p>
          </div>
          <span className="text-xs text-white/25">{totalDone} total</span>
        </div>

        {totalDone === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-3xl mb-2">📊</span>
            <p className="text-sm text-white/35">Complete tasks to see your graph.</p>
          </div>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 110 }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#f97316" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0"   />
                </linearGradient>
              </defs>
              {/* Grid */}
              {[0.25, 0.5, 0.75, 1].map(p => (
                <line key={p}
                  x1={PAD} y1={H - PAD - p * (H - 2 * PAD)}
                  x2={W - PAD} y2={H - PAD - p * (H - 2 * PAD)}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              ))}
              {/* Fill */}
              <path d={fillPath} fill="url(#chartGrad)" />
              {/* Line */}
              <path d={linePath} fill="none" stroke="#f97316"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Dots */}
              {pts.map((p, i) => p.count > 0 && (
                <circle key={i} cx={p.x} cy={p.y}
                  r={p === peakDay || i === pts.length - 1 ? 5 : 3}
                  fill={p.date === peakDay.date ? "#f97316" : "#a855f7"}
                  stroke="#0c0c0e" strokeWidth="2" />
              ))}
            </svg>
            {/* X labels — every other day */}
            <div className="flex justify-between mt-2 px-0.5">
              {data.filter((_, i) => i % 2 === 0).map(d => (
                <span key={d.date} className="text-[9px] text-white/20">{d.label}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-white/8 bg-white/[0.04] p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Activity Heatmap</h3>
        <div className="flex flex-wrap gap-1.5">
          {data.map(d => {
            const intensity = d.count / maxCount;
            const bg = d.count === 0 ? "bg-white/5"
              : intensity < 0.33 ? "bg-orange-500/25"
              : intensity < 0.66 ? "bg-orange-500/55"
              : "bg-orange-500";
            return (
              <div key={d.date} title={`${d.label}: ${d.count} task${d.count !== 1 ? "s" : ""}`}
                className={`w-8 h-8 rounded-md ${bg} flex items-center justify-center
                  transition-transform hover:scale-110 cursor-default`}>
                {d.count > 0 && (
                  <span className="text-[10px] font-bold text-white/80">{d.count}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-white/25">Less</span>
          {["bg-white/5","bg-orange-500/25","bg-orange-500/55","bg-orange-500"].map(c => (
            <div key={c} className={`w-4 h-4 rounded ${c}`} />
          ))}
          <span className="text-[10px] text-white/25">More</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type AppTab = "tasks" | "analytics";

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [userId, setUserId]   = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError]     = useState<string | null>(null);
  const [tab, setTab]         = useState<AppTab>("tasks");
  const tasksRef              = useRef(tasks);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/login", { state: { from: location }, replace: true });
      } else {
        setUserId(data.session.user.id);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        navigate("/login", { state: { from: location }, replace: true });
        setUserId(null);
      } else {
        setUserId(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch + Realtime ────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    setTasksError(null);
    const { data, error } = await supabase
      .from("tasks").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) setTasksError(error.message);
    else { setTasks(data ?? []); setTasksLoading(false); }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchTasks();
  }, [fetchTasks, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tasks:${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "tasks",
        filter: `user_id=eq.${userId}`,
      }, payload => {
        if (payload.eventType === "INSERT") {
          const t = payload.new as Task;
          setTasks(p => p.some(x => x.id === t.id) ? p : [t, ...p]);
        } else if (payload.eventType === "UPDATE") {
          const t = payload.new as Task;
          setTasks(p => p.map(x => x.id === t.id ? t : x));
        } else if (payload.eventType === "DELETE") {
          const t = payload.old as { id: string };
          setTasks(p => p.filter(x => x.id !== t.id));
        }
      })
      .subscribe(status => {
        if (status === "CHANNEL_ERROR") {
          console.warn("Realtime unavailable — polling every 5s");
          const iv = setInterval(fetchTasks, 5000);
          return () => clearInterval(iv);
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchTasks]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function addTask(newTask: { title: string; priority?: Task["priority"]; due_date?: string | null }) {
    if (!userId) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Task = {
      id: tempId, user_id: userId, title: newTask.title,
      description: null, status: "todo",
      priority: newTask.priority ?? "medium",
      due_date: newTask.due_date ?? null,
      completed_at: null, created_at: new Date().toISOString(),
    };
    setTasks(p => [optimistic, ...p]);
    const { data, error } = await supabase.from("tasks")
      .insert({ user_id: userId, title: newTask.title,
        priority: newTask.priority ?? "medium",
        due_date: newTask.due_date ?? null,
        status: "todo", completed_at: null })
      .select().single();
    if (error || !data) setTasks(p => p.filter(t => t.id !== tempId));
    else setTasks(p => p.map(t => t.id === tempId ? data : t));
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const prev = tasksRef.current.find(t => t.id === id);
    if (!prev) return;
    setTasks(p => p.map(t => t.id === id ? { ...t, ...updates } : t));
    const { error } = await supabase.from("tasks").update(updates).eq("id", id).eq("user_id", userId!);
    if (error) setTasks(p => p.map(t => t.id === id ? prev : t));
  }

  async function deleteTask(id: string) {
    const prev = tasksRef.current.find(t => t.id === id);
    setTasks(p => p.filter(t => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", userId!);
    if (error && prev) setTasks(p => [prev, ...p]);
  }

  async function toggleComplete(task: Task) {
    const isDone = task.status === "done";
    await updateTask(task.id, {
      status: isDone ? "todo" : "done",
      completed_at: isDone ? null : new Date().toISOString(),
    });
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const streak = computeStreak(filterCompleted(tasks));
  const todayUtc = new Date().toISOString().slice(0, 10);
  const completedToday = tasks.filter(
    t => t.status === "done" && t.completed_at?.slice(0, 10) === todayUtc
  ).length;
  const urgentTasks = tasks.filter(t => urgencyInfo(t.due_date, t.status).urgent);
  const loading = authLoading || tasksLoading;

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white"
      style={{ fontFamily: "'Courier New', Courier, monospace" }}>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 border-b border-white/8
        bg-[#0c0c0e]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between
          px-4 py-3 sm:px-6">

          {/* Left: logo + tabs */}
          <div className="flex items-center gap-4">
            <span className="text-lg font-black tracking-tight">
              Vibe<span className="text-orange-400">Tracker</span>
            </span>
            <div className="hidden sm:flex items-center gap-1">
              {(["tasks", "analytics"] as AppTab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                    tab === t
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-white/30 hover:text-white/60",
                  ].join(" ")}>
                  {t === "tasks" ? "📋 Tasks" : "📊 Analytics"}
                </button>
              ))}
            </div>
          </div>

          {/* Right: streak pill (mobile) + sign out */}
          <div className="flex items-center gap-2">
            <div className="flex sm:hidden items-center gap-1.5 rounded-full
              border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white">
              <span>{streak >= 7 ? "🔥" : "✨"}</span>
              <span>{loading ? "—" : `${streak}d`}</span>
            </div>
            <button onClick={signOut} aria-label="Sign out"
              className="rounded-lg border border-white/10 px-3 py-1.5
                text-xs font-medium text-white/50 hover:text-white
                hover:border-white/20 transition-all">
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile tab bar */}
        <div className="sm:hidden flex border-t border-white/5">
          {(["tasks", "analytics"] as AppTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={[
                "flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-all",
                tab === t
                  ? "text-orange-400 border-b-2 border-orange-400"
                  : "text-white/30",
              ].join(" ")}>
              {t === "tasks" ? "📋 Tasks" : "📊 Analytics"}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">

          {/* Right panel: streak (top on mobile, right sidebar on md+) */}
          <aside className="w-full md:order-last md:w-[260px] lg:w-[280px]
            md:flex-shrink-0 md:sticky md:top-[68px]"
            aria-label="Streak statistics">
            {loading
              ? <div className="h-64 rounded-2xl bg-white/[0.04] animate-pulse" />
              : <StreakPanel
                  streak={streak}
                  loading={loading}
                  totalTasks={tasks.length}
                  completedToday={completedToday}
                  urgentTasks={urgentTasks}
                />
            }
          </aside>

          {/* Left: main content area */}
          <section className="flex-1 min-w-0">

            {/* Tasks tab */}
            {tab === "tasks" && (
              <>
                <div className="mb-4 flex items-baseline justify-between">
                  <div>
                    <h1 className="text-2xl font-black text-white">Your Tasks</h1>
                    {!loading && (
                      <p className="mt-0.5 text-sm text-white/35">
                        {tasks.filter(t => t.status !== "done").length} remaining
                        {" · "}
                        {tasks.filter(t => t.status === "done").length} completed
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {!loading && tasks.length > 0 && <ProgressBar tasks={tasks} />}

                {/* Add task form */}
                <div className="mb-4">
                  <AddTaskForm onAdd={addTask} disabled={!userId || loading} />
                </div>

                {/* Task list */}
                <TaskList
                  tasks={tasks}
                  loading={loading}
                  error={tasksError}
                  onToggle={toggleComplete}
                  onUpdate={updateTask}
                  onDelete={deleteTask}
                />
              </>
            )}

            {/* Analytics tab */}
            {tab === "analytics" && (
              <>
                <div className="mb-5">
                  <h1 className="text-2xl font-black text-white">Analytics</h1>
                  <p className="text-sm text-white/35 mt-0.5">
                    Your performance over the last 14 days
                  </p>
                </div>
                {loading
                  ? <div className="space-y-3">
                      {[80, 140, 100].map(h => (
                        <div key={h} className="rounded-xl bg-white/[0.04] animate-pulse"
                          style={{ height: h }} />
                      ))}
                    </div>
                  : <AnalyticsTab tasks={tasks} />
                }
              </>
            )}

          </section>
        </div>
      </main>
    </div>
  );
}
