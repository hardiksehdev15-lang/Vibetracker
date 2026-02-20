/**
 * streak.test.ts
 * Unit tests for computeStreak() and helpers.
 * Run with: npx vitest run  OR  npx jest
 */

import { describe, it, expect } from "vitest";
import { computeStreak, toUtcDateStr, subtractDays, filterCompleted } from "../../src/lib/streak";

// Helper: build a fake task with completed_at on a given UTC date string
function task(dateStr: string) {
  return { completed_at: `${dateStr}T10:00:00Z` };
}

// Helper: fake "now" at noon UTC on a given date string
function now(dateStr: string) {
  return new Date(`${dateStr}T12:00:00Z`);
}

// ─── toUtcDateStr ──────────────────────────────────────────────────────────
describe("toUtcDateStr", () => {
  it("formats UTC date correctly", () => {
    expect(toUtcDateStr(new Date("2025-01-15T23:59:59Z"))).toBe("2025-01-15");
  });
  it("handles midnight UTC", () => {
    expect(toUtcDateStr(new Date("2025-03-01T00:00:00Z"))).toBe("2025-03-01");
  });
});

// ─── subtractDays ──────────────────────────────────────────────────────────
describe("subtractDays", () => {
  it("subtracts 1 day", () => {
    expect(subtractDays("2025-01-15", 1)).toBe("2025-01-14");
  });
  it("crosses month boundary", () => {
    expect(subtractDays("2025-03-01", 1)).toBe("2025-02-28");
  });
  it("crosses year boundary", () => {
    expect(subtractDays("2025-01-01", 1)).toBe("2024-12-31");
  });
  it("subtracts 0 days returns same", () => {
    expect(subtractDays("2025-06-10", 0)).toBe("2025-06-10");
  });
});

// ─── computeStreak ─────────────────────────────────────────────────────────
describe("computeStreak", () => {
  it("returns 0 for empty task list", () => {
    expect(computeStreak([], now("2025-01-15"))).toBe(0);
  });

  it("returns 0 when no completions within last 2 days", () => {
    const tasks = [task("2025-01-10"), task("2025-01-11")];
    expect(computeStreak(tasks, now("2025-01-15"))).toBe(0);
  });

  it("returns 1 when only today has a completion", () => {
    const tasks = [task("2025-01-15")];
    expect(computeStreak(tasks, now("2025-01-15"))).toBe(1);
  });

  it("returns 1 when only yesterday has a completion (today not yet done)", () => {
    const tasks = [task("2025-01-14")];
    expect(computeStreak(tasks, now("2025-01-15"))).toBe(1);
  });

  it("returns 3 for three consecutive days ending today", () => {
    const tasks = [task("2025-01-13"), task("2025-01-14"), task("2025-01-15")];
    expect(computeStreak(tasks, now("2025-01-15"))).toBe(3);
  });

  it("returns 3 for three consecutive days ending yesterday", () => {
    const tasks = [task("2025-01-12"), task("2025-01-13"), task("2025-01-14")];
    expect(computeStreak(tasks, now("2025-01-15"))).toBe(3);
  });

  it("breaks streak on gap — returns only the tail run", () => {
    // Gap on Jan 13 → only Jan 14+15 count
    const tasks = [
      task("2025-01-11"),
      task("2025-01-12"),
      // Jan 13 missing
      task("2025-01-14"),
      task("2025-01-15"),
    ];
    expect(computeStreak(tasks, now("2025-01-15"))).toBe(2);
  });

  it("ignores future dates in completions", () => {
    const tasks = [task("2025-01-15"), task("2025-01-16")];
    // "today" is Jan 15 — future completion on Jan 16 should not affect streak
    expect(computeStreak(tasks, now("2025-01-15"))).toBe(1);
  });

  it("handles duplicate completions on same day (deduped)", () => {
    const tasks = [
      task("2025-01-14"),
      task("2025-01-14"), // duplicate
      task("2025-01-15"),
      task("2025-01-15"), // duplicate
    ];
    expect(computeStreak(tasks, now("2025-01-15"))).toBe(2);
  });

  it("counts a 7-day streak correctly", () => {
    const tasks = Array.from({ length: 7 }, (_, i) => {
      const d = new Date("2025-01-15T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - (6 - i));
      return task(d.toISOString().slice(0, 10));
    });
    expect(computeStreak(tasks, now("2025-01-15"))).toBe(7);
  });

  it("month/year crossings do not break streak", () => {
    const tasks = [
      task("2024-12-30"),
      task("2024-12-31"),
      task("2025-01-01"),
      task("2025-01-02"),
    ];
    expect(computeStreak(tasks, now("2025-01-02"))).toBe(4);
  });

  it("returns 0 if two-day gap before today", () => {
    // Today = Jan 15, last completion = Jan 13 (gap on Jan 14)
    const tasks = [task("2025-01-13")];
    expect(computeStreak(tasks, now("2025-01-15"))).toBe(0);
  });
});

// ─── filterCompleted ────────────────────────────────────────────────────────
describe("filterCompleted", () => {
  it("includes only done tasks with non-null completed_at", () => {
    const tasks = [
      { status: "done", completed_at: "2025-01-15T10:00:00Z" },
      { status: "todo", completed_at: null },
      { status: "done", completed_at: null }, // done but no timestamp — skip
      { status: "inprogress", completed_at: "2025-01-15T10:00:00Z" },
    ];
    const result = filterCompleted(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].completed_at).toBe("2025-01-15T10:00:00Z");
  });
});
