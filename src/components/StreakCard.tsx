/**
 * StreakCard.tsx
 * The right-panel streak display. Fully dynamic — no hardcoded numbers.
 * Shows streak count with fire emoji, motivational copy, and progress ring.
 */

"use client";

import { useEffect, useRef } from "react";

type Props = {
  streak: number;
  loading?: boolean;
  totalTasks: number;
  completedToday: number;
};

// ─── Progress Ring (SVG) ─────────────────────────────────────────────────────

function ProgressRing({
  value,
  max,
  size = 96,
  stroke = 6,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const dashoffset = circ * (1 - pct);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="rotate-[-90deg]"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={stroke}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={pct >= 1 ? "#4ade80" : "#f97316"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dashoffset}
        style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease" }}
      />
    </svg>
  );
}

// ─── Animated Number ─────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const displayRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    const el = displayRef.current;
    if (!el) return;
    const start = prevRef.current;
    const end = value;
    if (start === end) return;
    prevRef.current = end;

    const duration = 600;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      if (el) el.textContent = String(current);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span ref={displayRef} className="tabular-nums">
      {value}
    </span>
  );
}

// ─── Motivational copy ───────────────────────────────────────────────────────

function getStreakMessage(streak: number, completedToday: number): string {
  if (completedToday === 0) return "Complete a task to keep your streak alive!";
  if (streak === 0) return "Start your streak today!";
  if (streak === 1) return "First day — let's build momentum.";
  if (streak < 3) return "You're on a roll! Keep going.";
  if (streak < 7) return `${streak} days strong. Don't break it now.`;
  if (streak < 14) return "One week down. You're unstoppable.";
  if (streak < 30) return "Elite consistency. Stay locked in.";
  return "Legendary streak. You're a machine.";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StreakCard({ streak, loading, totalTasks, completedToday }: Props) {
  const message = getStreakMessage(streak, completedToday);
  const ringGoal = Math.max(7, Math.ceil(streak / 7) * 7); // next milestone in multiples of 7

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6"
      aria-label={`Current streak: ${streak} days`}
    >
      {/* Background glow */}
      {streak > 0 && (
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl"
          style={{
            background: streak >= 7
              ? "rgba(74, 222, 128, 0.12)"
              : "rgba(249, 115, 22, 0.12)",
          }}
          aria-hidden="true"
        />
      )}

      <div className="relative flex flex-col items-center gap-4 text-center">
        {/* Ring + number */}
        <div className="relative">
          <ProgressRing value={streak} max={ringGoal} />
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {loading ? (
              <div className="h-7 w-8 animate-pulse rounded bg-white/10" />
            ) : (
              <>
                <span className="text-2xl font-black leading-none text-white">
                  <AnimatedNumber value={streak} />
                </span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-white/40">
                  {streak === 1 ? "day" : "days"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Label */}
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <span aria-hidden="true" className="text-lg">
              {streak === 0 ? "🌱" : streak >= 30 ? "⚡" : streak >= 7 ? "🔥" : "✨"}
            </span>
            <h2 className="text-base font-bold text-white">
              {loading ? (
                <span className="inline-block h-5 w-20 animate-pulse rounded bg-white/10" />
              ) : (
                <>
                  {streak}-Day Streak
                </>
              )}
            </h2>
          </div>

          <p className="mt-1.5 text-xs text-white/45 max-w-[160px] mx-auto leading-relaxed">
            {loading ? (
              <span className="inline-block h-4 w-32 animate-pulse rounded bg-white/10" />
            ) : (
              message
            )}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid w-full grid-cols-2 gap-2 pt-2 border-t border-white/8">
          <div className="text-center">
            <p className="text-lg font-bold text-white/90">
              {loading ? (
                <span className="inline-block h-6 w-6 animate-pulse rounded bg-white/10" />
              ) : (
                completedToday
              )}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-white/35">
              Today
            </p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white/90">
              {loading ? (
                <span className="inline-block h-6 w-6 animate-pulse rounded bg-white/10" />
              ) : (
                totalTasks
              )}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-white/35">
              Total
            </p>
          </div>
        </div>

        {/* Next milestone */}
        {!loading && streak > 0 && streak < ringGoal && (
          <p className="text-[10px] text-white/30">
            {ringGoal - streak} more day{ringGoal - streak !== 1 ? "s" : ""} to {ringGoal}-day milestone
          </p>
        )}
      </div>
    </div>
  );
}
