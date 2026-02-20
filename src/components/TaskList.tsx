/**
 * TaskList.tsx
 * Renders the full task list: loading skeleton, empty state, or task items.
 */


import type { Task } from "../lib/supabaseClient";
import { TaskItem } from "./TaskItem";

type Props = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  onToggle: (task: Task) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function TaskSkeleton() {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/3 px-4 py-3 animate-pulse">
      <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded bg-white/10" />
        <div className="h-3 w-1/4 rounded bg-white/5" />
      </div>
    </li>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <li className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 py-12 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-10 w-10 text-white/20"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <div>
        <p className="text-sm font-medium text-white/40">No tasks yet</p>
        <p className="mt-1 text-xs text-white/25">Add your first task above to get started.</p>
      </div>
    </li>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TaskList({ tasks, loading, error, onToggle, onUpdate, onDelete }: Props) {
  // Separate todo from done for visual grouping
  const todo = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  if (error) {
    return (
      <ul>
        <li
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300"
        >
          Failed to load tasks: {error}
        </li>
      </ul>
    );
  }

  if (loading) {
    return (
      <ul className="flex flex-col gap-2" aria-label="Loading tasks" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <TaskSkeleton key={i} />
        ))}
      </ul>
    );
  }

  if (tasks.length === 0) {
    return (
      <ul>
        <EmptyState />
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active tasks */}
      {todo.length > 0 && (
        <section aria-label="Active tasks">
          <ul className="flex flex-col gap-2" role="list">
            {todo.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Completed tasks */}
      {done.length > 0 && (
        <section aria-label="Completed tasks">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-white/25">
            Completed ({done.length})
          </p>
          <ul className="flex flex-col gap-2" role="list">
            {done.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
