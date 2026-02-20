/**
 * AddTaskForm.tsx
 * Form for creating a new task. Validates input, disables during submit,
 * and clears on success.
 */


import { useState, useRef, type FormEvent } from "react";
import type { NewTask } from "../hooks/useTasks";

type Props = {
  onAdd: (task: NewTask) => Promise<void>;
  disabled?: boolean;
};

export function AddTaskForm({ onAdd, disabled }: Props) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<NewTask["priority"]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setValidationError("Task title is required.");
      inputRef.current?.focus();
      return;
    }
    if (trimmed.length > 280) {
      setValidationError("Title must be 280 characters or fewer.");
      return;
    }
    setValidationError("");
    setSubmitting(true);
    try {
      await onAdd({
        title: trimmed,
        priority,
        due_date: dueDate || null,
      });
      setTitle("");
      setPriority("medium");
      setDueDate("");
      inputRef.current?.focus();
    } catch {
      setValidationError("Failed to add task. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const isDisabled = disabled || submitting;

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Add a new task"
      className="w-full"
      noValidate
    >
      <div className="flex flex-col gap-3">
        {/* Title input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <label htmlFor="task-title" className="sr-only">
              Task title
            </label>
            <input
              id="task-title"
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError("");
              }}
              placeholder="Add a new task…"
              disabled={isDisabled}
              maxLength={280}
              aria-required="true"
              aria-invalid={!!validationError}
              aria-describedby={validationError ? "task-title-error" : undefined}
              className={`
                w-full rounded-xl border bg-white/5 px-4 py-3 text-sm
                text-white placeholder-white/30 outline-none transition-all
                focus:ring-2 focus:ring-white/30
                disabled:cursor-not-allowed disabled:opacity-50
                ${validationError
                  ? "border-red-400/60 focus:ring-red-400/40"
                  : "border-white/10 hover:border-white/20"
                }
              `}
            />
          </div>

          <button
            type="submit"
            disabled={isDisabled}
            aria-label={submitting ? "Adding task…" : "Add task"}
            className="
              flex-shrink-0 rounded-xl bg-white/10 px-4 py-3 text-sm
              font-semibold text-white transition-all
              hover:bg-white/20 active:scale-95
              disabled:cursor-not-allowed disabled:opacity-40
              focus:outline-none focus:ring-2 focus:ring-white/30
            "
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Adding…
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add
              </span>
            )}
          </button>
        </div>

        {/* Secondary row: priority + due date (collapsible on mobile) */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="task-priority"
              className="text-xs font-medium text-white/50 whitespace-nowrap"
            >
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as NewTask["priority"])}
              disabled={isDisabled}
              className="
                rounded-lg border border-white/10 bg-white/5 px-3 py-1.5
                text-xs text-white outline-none transition-all
                hover:border-white/20 focus:ring-2 focus:ring-white/20
                disabled:opacity-50
              "
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="task-due"
              className="text-xs font-medium text-white/50 whitespace-nowrap"
            >
              Due
            </label>
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isDisabled}
              aria-label="Due date (optional)"
              className="
                rounded-lg border border-white/10 bg-white/5 px-3 py-1.5
                text-xs text-white outline-none transition-all
                hover:border-white/20 focus:ring-2 focus:ring-white/20
                disabled:opacity-50
                [color-scheme:dark]
              "
            />
          </div>
        </div>

        {/* Validation error */}
        {validationError && (
          <p
            id="task-title-error"
            role="alert"
            className="text-xs font-medium text-red-400"
          >
            {validationError}
          </p>
        )}
      </div>
    </form>
  );
}
