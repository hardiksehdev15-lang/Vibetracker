-- =============================================================================
-- Migration: 001_tasks_schema_and_rls.sql
-- Run this in: Supabase Dashboard → SQL Editor
--
-- What it does:
--   1. Creates/updates the tasks table with required columns
--   2. Enables Row Level Security (RLS) — per-user isolation
--   3. Enables Realtime on the tasks table
-- =============================================================================

-- ─── 1. TASKS TABLE ──────────────────────────────────────────────────────────
-- If the table already exists, we ALTER it to add missing columns.
-- If it does not exist, CREATE it from scratch.

CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 280),
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'todo'
                           CHECK (status IN ('todo', 'inprogress', 'done')),
  priority     TEXT        NOT NULL DEFAULT 'medium'
                           CHECK (priority IN ('low', 'medium', 'high')),
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns that may be missing from an existing table (safe to run multiple times)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'todo',
  ADD COLUMN IF NOT EXISTS priority     TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS due_date     DATE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for per-user queries (primary access pattern)
CREATE INDEX IF NOT EXISTS tasks_user_id_idx       ON public.tasks (user_id);
-- Index for streak computation (completed tasks by date)
CREATE INDEX IF NOT EXISTS tasks_completed_at_idx  ON public.tasks (user_id, completed_at)
  WHERE completed_at IS NOT NULL;


-- ─── 2. ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (so this is re-runnable)
DROP POLICY IF EXISTS "Users can view own tasks"   ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

-- SELECT: user sees only their own tasks
CREATE POLICY "Users can view own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: user can only insert rows with their own user_id
CREATE POLICY "Users can insert own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: user can only update their own rows
CREATE POLICY "Users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: user can only delete their own rows
CREATE POLICY "Users can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);


-- ─── 3. REALTIME ─────────────────────────────────────────────────────────────
-- Enable Supabase Realtime on the tasks table so the client subscription fires.
-- NOTE: On the free Supabase plan this is limited to 2 concurrent realtime connections.
-- If you hit the limit, the client falls back to 5s polling automatically (see useTasks.ts).

ALTER TABLE public.tasks REPLICA IDENTITY FULL;

-- Add tasks to the realtime publication (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
END
$$;


-- ─── 4. VERIFY ───────────────────────────────────────────────────────────────
-- Run these SELECT statements to confirm setup:

-- Should return your table columns:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'tasks';

-- Should return 4 policies:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tasks';

-- Should return 1 row with tablename = 'tasks':
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks';
