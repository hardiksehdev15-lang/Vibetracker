/**
 * TaskItem.tsx
 * A single task row with:
 * - checkbox to toggle complete
 * - inline title editing
 * - priority badge
 * - delete button
 * - fade-in animation on mount
 */

"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { Task } from "../lib/supabaseClient";

type Props = {
  task: Task;
  onToggle: (task: Task) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const PRIORITY_STYLES: Record<Task["priority"], string> = {
  high: "bg-red-500/20 text-red-300 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export function TaskItem({ task, onToggle, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const isDone = task.status === "done";

  // Focus input when editing starts
  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  async function handleToggle() {
    if (toggling) return;
    setToggling(true);
    await onToggle(task);
    setToggling(false);
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    await onDelete(task.id);
    // Component may unmount from state update; no need to reset
  }

  function startEdit() {
    setEditValue(task.title);
    setEditing(true);
  }

  async function commitEdit() {
    setEditing(false);
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === task.title) {
      setEditValue(task.title);
      return;
    }
    await onUpdate(task.id, { title: trimmed });
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") {
      setEditValue(task.title);
      setEditing(false);
    }
  }

  // Temp tasks (optimistic) have ids starting with "temp-"
  const isTemp = task.id.startsWith("temp-");

  return (
    <li
      className={`
        group flex items-start gap-3 rounded-xl border px-4 py-3
        transition-all duration-300
        ${isTemp ? "opacity-60" : "opacity-100"}
        ${isDone
          ? "border-white/5 bg-white/3"
          : "border-white/10 bg-white/5 hover:border-white/20"
        }
        animate-in fade-in slide-in-from-top-1 duration-200
      `}
      aria-label={`Task: ${task.title}${isDone ? " (completed)" : ""}`}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={toggling || isTemp}
        aria-label={isDone ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as complete`}
        className={`
          mt-0.5 flex-shrink-0 h-5 w-5 rounded-full border-2 transition-all duration-200
          flex items-center justify-center
          focus:outline-none focus:ring-2 focus:ring-white/30
          disabled:cursor-wait
          ${isDone
            ? "border-emerald-400 bg-emerald-400/20"
            : "border-white/30 hover:border-white/60 bg-transparent"
          }
        `}
      >
        {isDone && (
          <svg
            className="h-3 w-3 text-emerald-400"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {toggling && (
          <svg
            className="h-3 w-3 animate-spin text-white/50"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={editRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleEditKeyDown}
            maxLength={280}
            aria-label="Edit task title"
            className="
              w-full rounded-lg border border-white/20 bg-white/10
              px-2 py-0.5 text-sm text-white outline-none
              focus:ring-2 focus:ring-white/30
            "
          />
        ) : (
          <button
            onClick={startEdit}
            disabled={isDone || isTemp}
            aria-label={`Edit task: ${task.title}`}
            className={`
              text-left text-sm font-medium transition-colors duration-200
              disabled:cursor-default
              ${isDone
                ? "text-white/30 line-through"
                : "text-white/85 hover:text-white"
              }
            `}
          >
            {task.title}
          </button>
        )}

        {/* Meta row */}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`
              rounded-full border px-2 py-0.5 text-xs font-medium
              ${PRIORITY_STYLES[task.priority]}
            `}
          >
            {task.priority}
          </span>

          {task.due_date && (
            <span className={`text-xs ${
              new Date(task.due_date) < new Date() && !isDone
                ? "text-red-400"
                : "text-white/40"
            }`}>
              Due {new Date(task.due_date).toLocaleDateString(undefined, {
                month: "short", day: "numeric",
              })}
            </span>
          )}

          {isDone && task.completed_at && (
            <span className="text-xs text-emerald-400/60">
              ✓ {new Date(task.completed_at).toLocaleDateString(undefined, {
                month: "short", day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Delete button — visible on hover / focus */}
      <button
        onClick={handleDelete}
        disabled={deleting || isTemp}
        aria-label={`Delete task: ${task.title}`}
        className="
          flex-shrink-0 rounded-lg p-1.5 text-white/0 transition-all duration-150
          group-hover:text-white/30 hover:!text-red-400 hover:bg-red-400/10
          focus:text-white/30 focus:outline-none focus:ring-2 focus:ring-red-400/30
          disabled:cursor-wait
        "
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}
