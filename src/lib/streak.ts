/**
 * streak.ts
 * Pure functions for computing daily streaks from completed tasks.
 * Strategy: UTC dates, per-user, consecutive-day counting.
 *
 * A "streak day" = any UTC calendar day that has ≥1 completed task.
 * Streak = count of consecutive days ending today (or yesterday if today
 * has no completion yet — so the streak doesn't break until the day is over).
 */

export type CompletedTask = {
  completed_at: string | Date; // ISO string or Date object
};

/**
 * Format a Date as a UTC date string "YYYY-MM-DD".
 */
export function toUtcDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Subtract `days` from a UTC date string, return new UTC date string.
 */
export function subtractDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return toUtcDateStr(d);
}

/**
 * Compute the current streak from an array of completed tasks.
 *
 * Algorithm:
 * 1. Build a Set of unique UTC date strings from completed_at timestamps.
 * 2. Start from today (UTC). If today has no completions, check if yesterday
 *    does — if so, the streak is still alive (user hasn't had a chance today yet).
 *    If yesterday also has none, streak = 0.
 * 3. Count backwards while each previous day exists in the set.
 *
 * @param tasks  Array of tasks with a completed_at field (non-null = completed).
 * @param now    Override for "today" — useful in tests. Defaults to new Date().
 * @returns      Integer streak count (0 if no streak).
 */
export function computeStreak(
  tasks: CompletedTask[],
  now: Date = new Date()
): number {
  if (!tasks.length) return 0;

  // Build set of UTC date strings for days with completions
  const completedDays = new Set<string>(
    tasks.map((t) => toUtcDateStr(new Date(t.completed_at)))
  );

  const today = toUtcDateStr(now);
  const yesterday = subtractDays(today, 1);

  // Determine the anchor: the most recent day to start counting from.
  // If today already has a completion, start from today.
  // If not but yesterday does, start from yesterday (streak still live).
  // Otherwise no streak.
  let anchor: string;
  if (completedDays.has(today)) {
    anchor = today;
  } else if (completedDays.has(yesterday)) {
    anchor = yesterday;
  } else {
    return 0;
  }

  // Count consecutive days backwards from anchor
  let streak = 0;
  let cursor = anchor;
  while (completedDays.has(cursor)) {
    streak++;
    cursor = subtractDays(cursor, 1);
  }

  return streak;
}

/**
 * Extract only the completed tasks from a mixed list.
 * Tasks are "completed" when status === 'done' AND completed_at is non-null.
 */
export function filterCompleted(
  tasks: Array<{ status: string; completed_at: string | null | Date }>
): CompletedTask[] {
  return tasks
    .filter((t) => t.status === "done" && t.completed_at != null)
    .map((t) => ({ completed_at: t.completed_at as string | Date }));
}
