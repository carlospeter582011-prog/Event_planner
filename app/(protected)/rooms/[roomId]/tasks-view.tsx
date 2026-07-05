"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import Modal from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Role, TaskPriority } from "@/types";

interface TasksViewProps {
  roomId: string;
  role: Role;
  userId: string;
}

interface TaskRow {
  id: string;
  room_id: string;
  activity_block_id: string | null;
  title: string;
  due_date: string | null;
  priority: TaskPriority;
  is_completed: boolean;
}

export default function TasksView({ roomId, role, userId }: TasksViewProps) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [addOpen, setAddOpen] = useState(false);

  const canEdit = role === "HOST" || role === "EDITOR";

  const fetchTasks = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    setTasks((data as TaskRow[] | null) ?? []);
    if (showLoader) setLoading(false);
  }, [roomId, supabase]);

  useEffect(() => {
    fetchTasks(true);
    const interval = window.setInterval(fetchTasks, 5000);
    return () => window.clearInterval(interval);
  }, [fetchTasks]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `room_id=eq.${roomId}` },
        () => fetchTasks(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, supabase, fetchTasks]);

  // Toggle completion
  async function toggleTask(taskId: string, current: boolean) {
    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: !current })
      .eq("id", taskId);
    if (error) toast.error(error.message);
  }

  // Delete task
  async function deleteTask(taskId: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted");
  }

  // Create task
  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const { error } = await supabase.from("tasks").insert({
      room_id: roomId,
      title: formData.get("title") as string,
      due_date: formData.get("due_date") ? new Date(formData.get("due_date") as string).toISOString() : null,
      priority: (formData.get("priority") as TaskPriority) || "MEDIUM",
    });

    if (error) { toast.error(error.message); return; }
    toast.success("Task created!");
    setAddOpen(false);
  }

  const filtered = tasks.filter((t) => {
    if (filter === "active") return !t.is_completed;
    if (filter === "completed") return t.is_completed;
    return true;
  });

  const completedCount = tasks.filter((t) => t.is_completed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6 text-brand-500" />
        <span className="ml-2 text-sm text-slate-500">Loading tasks…</span>
      </div>
    );
  }

  return (
    <div data-testid="tasks-view">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
            {(["all", "active", "completed"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                data-testid={`task-filter-${f}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">
            {completedCount}/{tasks.length} done
          </span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="btn-primary text-sm"
            data-testid="btn-add-task"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add task
          </button>
        )}
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="mb-4">
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(completedCount / tasks.length) * 100}%` }}
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={tasks.length}
              data-testid="task-progress-bar"
            />
          </div>
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 ? (
        <EmptyState
          testId="empty-tasks"
          title={filter === "all" ? "No tasks yet" : `No ${filter} tasks`}
          description={canEdit ? "Create tasks to track action items for this event." : "No tasks match this filter."}
        />
      ) : (
        <div className="space-y-2" data-testid="task-list">
          {filtered.map((task) => (
            <div
              key={task.id}
              className={`card flex items-center gap-3 px-4 py-3 transition-colors ${
                task.is_completed ? "opacity-60" : ""
              }`}
              data-testid={`task-${task.id}`}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => toggleTask(task.id, task.is_completed)}
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  task.is_completed
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 hover:border-brand-500 dark:border-slate-600"
                }`}
                aria-label={`Mark "${task.title}" as ${task.is_completed ? "incomplete" : "complete"}`}
                data-testid={`task-toggle-${task.id}`}
              >
                {task.is_completed && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.is_completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="priority" value={task.priority}>
                    {task.priority}
                  </Badge>
                  {task.due_date && (
                    <span className="text-xs text-slate-500">
                      Due: {formatDate(task.due_date)}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => deleteTask(task.id)}
                  className="text-slate-400 hover:text-red-500 text-sm"
                  aria-label={`Delete "${task.title}"`}
                  data-testid={`task-delete-${task.id}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Task Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Create Task">
        <form onSubmit={handleCreateTask} data-testid="create-task-form">
          <div className="space-y-4">
            <div>
              <label htmlFor="task-title" className="label">Title <span className="text-red-500">*</span></label>
              <input
                id="task-title"
                name="title"
                type="text"
                required
                placeholder="Book venue for Friday"
                className="input"
                data-testid="create-task-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="task-due" className="label">Due date</label>
                <input
                  id="task-due"
                  name="due_date"
                  type="date"
                  className="input"
                  data-testid="create-task-due"
                />
              </div>
              <div>
                <label htmlFor="task-priority" className="label">Priority</label>
                <select
                  id="task-priority"
                  name="priority"
                  defaultValue="MEDIUM"
                  className="input"
                  data-testid="create-task-priority"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">Create task</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
