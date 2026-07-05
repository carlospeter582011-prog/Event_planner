"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import Modal from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";
import type { Role, RoomPermissions, TaskPriority, TaskVisibility } from "@/types";
import CommentsPanel from "./comments-panel";

interface TasksViewProps {
  roomId: string;
  role: Role;
  userId: string;
  permissions: RoomPermissions;
}

interface TaskRow {
  id: string;
  room_id: string;
  activity_block_id: string | null;
  owner_id: string;
  title: string;
  due_date: string | null;
  priority: TaskPriority;
  visibility: TaskVisibility;
  is_completed: boolean;
}

export default function TasksView({ roomId, userId, permissions }: TasksViewProps) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "private" | "public">("all");
  const [addOpen, setAddOpen] = useState(false);

  const canManageTasks = permissions.manage_tasks;
  const canCreatePublicTasks = permissions.create_public_tasks;

  const fetchTasks = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      if (showLoader) setLoading(false);
      return;
    }

    setTasks((data as TaskRow[] | null) ?? []);
    if (showLoader) setLoading(false);
  }, [roomId, supabase]);

  useEffect(() => {
    fetchTasks(true);
    const interval = window.setInterval(fetchTasks, 5000);
    return () => window.clearInterval(interval);
  }, [fetchTasks]);

  useEffect(() => {
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `room_id=eq.${roomId}` },
        () => fetchTasks(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase, fetchTasks]);

  async function toggleTask(task: TaskRow) {
    const isOwner = task.owner_id === userId;
    if (!isOwner && !canManageTasks) return;

    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: !task.is_completed })
      .eq("id", task.id);
    if (error) toast.error(error.message);
  }

  async function deleteTask(task: TaskRow) {
    const isOwner = task.owner_id === userId;
    if (!isOwner && !canManageTasks) return;

    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task deleted");
  }

  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const visibility = (formData.get("visibility") as TaskVisibility) || "PRIVATE";

    if (visibility === "PUBLIC" && !canCreatePublicTasks) {
      toast.error("Host has not enabled public to-do creation for you.");
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      room_id: roomId,
      owner_id: userId,
      visibility,
      title: formData.get("title") as string,
      due_date: formData.get("due_date") ? new Date(formData.get("due_date") as string).toISOString() : null,
      priority: (formData.get("priority") as TaskPriority) || "MEDIUM",
    });

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task created!");
    setAddOpen(false);
  }

  const filtered = tasks.filter((task) => {
    if (filter === "active") return !task.is_completed;
    if (filter === "completed") return task.is_completed;
    if (filter === "private") return task.visibility === "PRIVATE";
    if (filter === "public") return task.visibility === "PUBLIC";
    return true;
  });

  const completedCount = tasks.filter((task) => task.is_completed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6 text-brand-500" />
        <span className="ml-2 text-sm text-slate-500">Loading tasks...</span>
      </div>
    );
  }

  return (
    <div data-testid="tasks-view">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
            {(["all", "active", "completed", "private", "public"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                data-testid={`task-filter-${item}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === item
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">
            {completedCount}/{tasks.length} done
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="btn-primary text-sm"
          data-testid="btn-add-task"
        >
          Add to-do
        </button>
      </div>

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

      {filtered.length === 0 ? (
        <EmptyState
          testId="empty-tasks"
          title={filter === "all" ? "No to-dos yet" : `No ${filter} to-dos`}
          description="Create private personal to-dos or public room to-dos when the host allows it."
        />
      ) : (
        <div className="space-y-3" data-testid="task-list">
          {filtered.map((task) => {
            const isOwner = task.owner_id === userId;
            const canMutateTask = isOwner || canManageTasks;
            return (
              <article
                key={task.id}
                className={`card px-4 py-3 transition-colors ${task.is_completed ? "opacity-70" : ""}`}
                data-testid={`task-${task.id}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleTask(task)}
                    disabled={!canMutateTask}
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      task.is_completed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 hover:border-brand-500 dark:border-slate-600"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    aria-label={`Mark "${task.title}" as ${task.is_completed ? "incomplete" : "complete"}`}
                    data-testid={`task-toggle-${task.id}`}
                  >
                    {task.is_completed && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${task.is_completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="priority" value={task.priority}>
                        {task.priority}
                      </Badge>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {task.visibility === "PRIVATE" ? "Private" : "Public"}
                      </span>
                      {isOwner && (
                        <span className="text-xs text-slate-500">Yours</span>
                      )}
                      {task.due_date && (
                        <span className="text-xs text-slate-500">
                          Due: {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  {canMutateTask && (
                    <button
                      type="button"
                      onClick={() => deleteTask(task)}
                      className="text-sm font-medium text-red-500 hover:text-red-700"
                      aria-label={`Delete "${task.title}"`}
                      data-testid={`task-delete-${task.id}`}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="mt-3">
                  <CommentsPanel
                    roomId={roomId}
                    userId={userId}
                    permissions={permissions}
                    targetType="TASK"
                    targetId={task.id}
                    title="To-do comments"
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Create To-do">
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
            <div className="grid gap-4 sm:grid-cols-3">
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
              <div>
                <label htmlFor="task-visibility" className="label">Visibility</label>
                <select
                  id="task-visibility"
                  name="visibility"
                  defaultValue="PRIVATE"
                  className="input"
                  data-testid="create-task-visibility"
                >
                  <option value="PRIVATE">Private</option>
                  <option value="PUBLIC" disabled={!canCreatePublicTasks}>
                    Public
                  </option>
                </select>
              </div>
            </div>
            {!canCreatePublicTasks && (
              <p className="text-xs text-slate-500">
                The host has not enabled public to-do creation for your account.
              </p>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">Create to-do</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
