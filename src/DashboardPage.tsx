/**
 * DashboardPage.tsx  (or app/dashboard/page.tsx if using Next.js App Router)
 *
 * Drop-in replacement for whichever page currently has the hardcoded streak.
 * Handles:
 * - Auth gate (redirect to /login if no session)
 * - Responsive two-column → single-column layout
 * - Wires useTasks hook to all child components
 *
 * ─── Responsive layout ────────────────────────────────────────────────────
 *   Mobile  (< 768px):  single column, streak card on top, tasks below
 *   Tablet  (768-1023px): two columns 3/5 + 2/5
 *   Desktop (≥ 1024px): two columns 2/3 + 1/3
 */

"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import { useTasks } from "./hooks/useTasks";
import { AddTaskForm } from "./components/AddTaskForm";
import { TaskList } from "./components/TaskList";
import { StreakCard } from "./components/StreakCard";

export default function DashboardPage() {
  const navigate = useNavigate(); 
  const [userId, setUserId] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login"); // Use navigate instead of router.replace
      } else {
        setUserId(session.user.id);
      }
      setAuthLoading(false);
    };

    checkAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!session) {
        navigate("/login");
        setUserId(null);
      } else {
        setUserId(session.user.id);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  const {
    tasks,
    streak,
    loading: tasksLoading,
    error,
    addTask,
    updateTask,
    deleteTask,
    toggleComplete,
  } = useTasks(userId);

  // Compute "completed today" for the streak card stats row
  const todayUtc = new Date().toISOString().slice(0, 10);
  const completedToday = tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completed_at &&
      t.completed_at.slice(0, 10) === todayUtc
  ).length;

  const loading = authLoading || tasksLoading;

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white">
      {/* ─── Viewport meta (ensure this is in your <head>) ─────────────────
          Add to app/layout.tsx or _document.tsx:
          <meta name="viewport" content="width=device-width, initial-scale=1" />
      ──────────────────────────────────────────────────────────────────── */}

      {/* ─── Top nav ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0f0f11]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tight text-white">
              Vibe<span className="text-orange-400">Tracker</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Streak pill in nav — visible on mobile where right panel is below */}
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white sm:hidden">
              <span aria-hidden="true">{streak >= 7 ? "🔥" : "✨"}</span>
              <span>
                {loading
                  ? "—"
                  : `${streak} day${streak !== 1 ? "s" : ""}`}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-white/20 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main content ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/*
          Layout:
          - Mobile:   streak card → task section (stacked)
          - md+:      tasks left (3/5) | streak right (2/5)
          - lg+:      tasks left (2/3) | streak right (1/3)
        */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-6 lg:gap-8">

          {/* ── Streak card (mobile: top, md+: right sidebar) ─────────────── */}
          <aside
            className="w-full md:order-last md:w-2/5 lg:w-1/3 md:sticky md:top-20"
            aria-label="Streak statistics"
          >
            <StreakCard
              streak={streak}
              loading={loading}
              totalTasks={tasks.length}
              completedToday={completedToday}
            />
          </aside>

          {/* ── Tasks column ──────────────────────────────────────────────── */}
          <section
            className="flex-1 min-w-0 md:w-3/5 lg:w-2/3"
            aria-label="Task manager"
          >
            {/* Section header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white sm:text-2xl">
                  Your Tasks
                </h1>
                {!loading && (
                  <p className="mt-0.5 text-sm text-white/40">
                    {tasks.filter((t) => t.status !== "done").length} remaining
                    {" · "}
                    {tasks.filter((t) => t.status === "done").length} completed
                  </p>
                )}
              </div>
            </div>

            {/* Add task form */}
            <div className="mb-4">
              <AddTaskForm onAdd={addTask} disabled={!userId || loading} />
            </div>

            {/* Task list */}
            <TaskList
              tasks={tasks}
              loading={loading}
              error={error}
              onToggle={toggleComplete}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
