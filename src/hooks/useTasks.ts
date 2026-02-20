/**
 * useTasks.ts
 * Central hook for all task state: fetching, realtime subscriptions,
 * CRUD operations with optimistic UI, and streak computation.
 *
 * Usage:
 *   const { tasks, streak, loading, error, addTask, updateTask, deleteTask, toggleComplete } = useTasks(userId);
 */


import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, type Task } from "../lib/supabaseClient";
import { computeStreak, filterCompleted } from "../lib/streak";

// ─── Types ────────────────────────────────────────────────────────────────

export type NewTask = {
  title: string;
  description?: string;
  priority?: Task["priority"];
  due_date?: string | null;
};

export type TasksState = {
  tasks: Task[];
  streak: number;
  loading: boolean;
  error: string | null;
  addTask: (task: NewTask) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleComplete: (task: Task) => Promise<void>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useTasks(userId: string | null): TasksState {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compute streak from current tasks (memoised inline — cheap)
  const streak = computeStreak(filterCompleted(tasks));

  // Keep a ref to tasks for use inside realtime callbacks without stale closure
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // ─── Initial fetch ──────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTasks(data ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ─── Realtime subscription ──────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`tasks:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newTask = payload.new as Task;
            setTasks((prev) => {
              // Avoid duplicate if optimistic update already added it
              if (prev.some((t) => t.id === newTask.id)) return prev;
              return [newTask, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Task;
            setTasks((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          // Fallback: poll every 5s if realtime fails (e.g. free plan limits)
          console.warn("Supabase realtime unavailable — falling back to polling");
          const interval = setInterval(fetchTasks, 5000);
          return () => clearInterval(interval);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTasks]);

  // ─── CRUD operations ────────────────────────────────────────────────────

  /**
   * addTask — optimistic insert.
   * Creates a temp task with a fake ID, replaces on server confirmation
   * (or rolls back on error).
   */
  const addTask = useCallback(
    async (newTask: NewTask) => {
      if (!userId) return;

      const tempId = `temp-${Date.now()}`;
      const optimistic: Task = {
        id: tempId,
        user_id: userId,
        title: newTask.title,
        description: newTask.description ?? null,
        status: "todo",
        priority: newTask.priority ?? "medium",
        due_date: newTask.due_date ?? null,
        completed_at: null,
        created_at: new Date().toISOString(),
      };

      // Optimistically add to state
      setTasks((prev) => [optimistic, ...prev]);

      const { data, error: insertError } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title: newTask.title,
          description: newTask.description ?? null,
          status: "todo",
          priority: newTask.priority ?? "medium",
          due_date: newTask.due_date ?? null,
          completed_at: null,
        })
        .select()
        .single();

      if (insertError || !data) {
        // Rollback
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        setError(insertError?.message ?? "Failed to add task");
        return;
      }

      // Replace temp with real task (realtime may also fire, deduplication handles it)
      setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)));
    },
    [userId]
  );

  /**
   * updateTask — optimistic update.
   */
  const updateTask = useCallback(
    async (id: string, updates: Partial<Task>) => {
      const previous = tasksRef.current.find((t) => t.id === id);
      if (!previous) return;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );

      const { error: updateError } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId!);

      if (updateError) {
        // Rollback
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? previous : t))
        );
        setError(updateError.message);
      }
    },
    [userId]
  );

  /**
   * deleteTask — optimistic delete.
   */
  const deleteTask = useCallback(
    async (id: string) => {
      const previous = tasksRef.current.find((t) => t.id === id);
      if (!previous) return;

      // Optimistic remove
      setTasks((prev) => prev.filter((t) => t.id !== id));

      const { error: deleteError } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id)
        .eq("user_id", userId!);

      if (deleteError) {
        // Rollback
        setTasks((prev) => [previous, ...prev]);
        setError(deleteError.message);
      }
    },
    [userId]
  );

  /**
   * toggleComplete — flip a task between todo/done with correct completed_at.
   */
  const toggleComplete = useCallback(
    async (task: Task) => {
      const isDone = task.status === "done";
      const updates: Partial<Task> = {
        status: isDone ? "todo" : "done",
        completed_at: isDone ? null : new Date().toISOString(),
      };
      await updateTask(task.id, updates);
    },
    [updateTask]
  );

  return {
    tasks,
    streak,
    loading,
    error,
    addTask,
    updateTask,
    deleteTask,
    toggleComplete,
  };
}
