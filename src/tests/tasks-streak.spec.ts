/**
 * e2e/tasks-streak.spec.ts
 * End-to-end test: add task → mark complete → verify streak updates.
 *
 * Prerequisites:
 *   1. Set TEST_EMAIL and TEST_PASSWORD in .env.test (Supabase test user)
 *   2. Run: npx playwright test
 *
 * The test creates a task, completes it, and verifies:
 *   - Task appears in the list
 *   - Streak number updates (≥ 1) in the right panel
 *   - The streak shows immediately without page refresh (realtime / optimistic)
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const TEST_EMAIL = process.env.TEST_EMAIL || "test@vibetracker.test";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "testpassword123";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10_000 });
}

async function clearTasks(page: Page) {
  // Delete all existing tasks so tests start from a clean state
  // We do this via the UI to avoid direct DB calls in E2E tests
  const deleteButtons = page.getByRole("button", { name: /delete task/i });
  while ((await deleteButtons.count()) > 0) {
    await deleteButtons.first().click();
    await page.waitForTimeout(300);
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Task CRUD + Streak", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    // Give the page a moment to load tasks
    await page.waitForLoadState("networkidle");
    await clearTasks(page);
  });

  test("adds a task and it appears in the list", async ({ page }) => {
    const title = `Test task ${Date.now()}`;

    // Fill and submit the add task form
    await page.getByLabel(/task title/i).fill(title);
    await page.getByRole("button", { name: /^add$/i }).click();

    // Task should appear immediately (optimistic)
    await expect(page.getByRole("listitem", { name: new RegExp(title, "i") })).toBeVisible({
      timeout: 3000,
    });
  });

  test("marks a task complete and streak increments to at least 1", async ({ page }) => {
    const title = `Complete me ${Date.now()}`;

    // Note the current streak
    const streakBefore = await page
      .getByLabel(/current streak/i)
      .getAttribute("aria-label");
    const prevStreak = parseInt(streakBefore?.match(/\d+/)?.[0] ?? "0", 10);

    // Add a task
    await page.getByLabel(/task title/i).fill(title);
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 3000 });

    // Mark it complete
    await page.getByRole("button", { name: new RegExp(`mark.*${title}.*complete`, "i") }).click();

    // Task should show as completed (strikethrough / done styling)
    await expect(
      page.getByRole("listitem", { name: new RegExp(title, "i") })
    ).toHaveClass(/done|completed|line-through/, { timeout: 3000 });

    // Streak should be at least 1
    await expect(page.getByLabel(/current streak/i)).toContainText(/[1-9]\d* day/, {
      timeout: 5000,
    });

    // Streak must be >= previous (it can only go up within the same day)
    const streakAfterText = await page
      .getByLabel(/current streak/i)
      .getAttribute("aria-label");
    const newStreak = parseInt(streakAfterText?.match(/\d+/)?.[0] ?? "0", 10);
    expect(newStreak).toBeGreaterThanOrEqual(1);
    expect(newStreak).toBeGreaterThanOrEqual(prevStreak);
  });

  test("deletes a task and it disappears from the list", async ({ page }) => {
    const title = `Delete me ${Date.now()}`;

    // Add task
    await page.getByLabel(/task title/i).fill(title);
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 3000 });

    // Delete it
    const listItem = page.getByRole("listitem", { name: new RegExp(title, "i") });
    await listItem.getByRole("button", { name: /delete task/i }).click();

    // Should disappear (optimistic)
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 3000 });
  });

  test("edits a task title inline", async ({ page }) => {
    const original = `Original ${Date.now()}`;
    const updated = `Updated ${Date.now()}`;

    // Add
    await page.getByLabel(/task title/i).fill(original);
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText(original)).toBeVisible({ timeout: 3000 });

    // Click title to edit
    await page.getByRole("button", { name: new RegExp(`edit task.*${original}`, "i") }).click();
    await page.getByLabel(/edit task title/i).fill(updated);
    await page.keyboard.press("Enter");

    // Should show updated title
    await expect(page.getByText(updated)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(original)).not.toBeVisible();
  });

  test("streak shows 0 when no tasks are completed", async ({ page }) => {
    // All tasks were deleted in beforeEach, so streak should be 0 or show "0 days"
    const streakEl = page.getByLabel(/current streak/i);
    await expect(streakEl).toContainText(/0 day/i, { timeout: 3000 });
  });

  test("realtime: completing a task on another tab updates this tab", async ({
    page,
    context,
  }) => {
    const title = `Realtime task ${Date.now()}`;

    // Add task on page 1
    await page.getByLabel(/task title/i).fill(title);
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 3000 });

    // Open a second tab, complete the task there
    const page2 = await context.newPage();
    await page2.goto(`${BASE_URL}/dashboard`);
    await page2.waitForLoadState("networkidle");

    // Mark it complete on page2
    await page2
      .getByRole("button", { name: new RegExp(`mark.*${title}.*complete`, "i") })
      .click();

    // Back on page1, streak should update within ~2s (realtime subscription)
    await expect(page.getByLabel(/current streak/i)).toContainText(/[1-9]\d* day/, {
      timeout: 5000,
    });

    await page2.close();
  });
});

test.describe("Responsive layout", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  const viewports = [
    { name: "mobile-sm", width: 360, height: 800 },
    { name: "mobile-iphone", width: 375, height: 812 },
    { name: "mobile-large", width: 412, height: 915 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    test(`layout is correct at ${vp.name} (${vp.width}×${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState("networkidle");

      // No horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(vp.width + 5); // 5px tolerance

      // Key elements are visible
      await expect(page.getByLabel(/task title/i)).toBeVisible();
      await expect(page.getByLabel(/current streak/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

      // Screenshot for visual review (stored in playwright-report/)
      await page.screenshot({
        path: `playwright-report/screenshots/${vp.name}.png`,
        fullPage: false,
      });
    });
  }
});
