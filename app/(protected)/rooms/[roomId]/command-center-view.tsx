"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import type { ActivityStatus, PollStatus, Role, TaskPriority } from "@/types";

interface CommandCenterViewProps {
  roomId: string;
  roomBudgetCap: number;
  participants: ParticipantRecord[];
  role: Role;
}

interface ParticipantRecord {
  id: string;
  role: Role;
  joined_at?: string;
  profile?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

interface DayRow {
  id: string;
  room_id: string;
  title: string;
  sequence_order: number;
}

interface ActivityRow {
  id: string;
  day_id: string;
  title: string;
  status: ActivityStatus;
  cost: number;
}

interface TaskRow {
  id: string;
  priority: TaskPriority;
  is_completed: boolean;
}

interface PollRow {
  id: string;
  status: PollStatus;
  activity_block_id: string;
}

const roleCapabilities: Record<Role, string[]> = {
  HOST: [
    "Room settings",
    "Budget cap",
    "Timeline CRUD",
    "Poll overrule",
    "Task deletion",
    "Role control",
  ],
  EDITOR: ["Timeline CRUD", "Poll creation", "Task updates", "Voting", "Chat"],
  VIEWER: ["Read-only planning", "Voting", "Budget visibility", "Chat"],
};

export default function CommandCenterView({
  roomId,
  roomBudgetCap,
  participants,
  role,
}: CommandCenterViewProps) {
  const supabase = useMemo(() => createClient(), []);
  const [days, setDays] = useState<DayRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);

    const { data: dayData } = await supabase
      .from("days")
      .select("id, room_id, title, sequence_order")
      .eq("room_id", roomId)
      .order("sequence_order", { ascending: true });

    const typedDays = (dayData as DayRow[] | null) ?? [];
    const dayIds = typedDays.map((day) => day.id);

    const { data: activityData } = dayIds.length
      ? await supabase
          .from("activity_blocks")
          .select("id, day_id, title, status, cost")
          .in("day_id", dayIds)
      : { data: [] };

    const typedActivities = (activityData as ActivityRow[] | null) ?? [];
    const activityIds = typedActivities.map((activity) => activity.id);

    const [{ data: taskData }, { data: pollData }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, priority, is_completed")
        .eq("room_id", roomId),
      activityIds.length
        ? supabase
            .from("polls")
            .select("id, status, activity_block_id")
            .in("activity_block_id", activityIds)
        : Promise.resolve({ data: [] }),
    ]);

    setDays(typedDays);
    setActivities(typedActivities);
    setTasks((taskData as TaskRow[] | null) ?? []);
    setPolls((pollData as PollRow[] | null) ?? []);
    if (showLoader) setLoading(false);
  }, [roomId, supabase]);

  useEffect(() => {
    fetchData(true);
    const interval = window.setInterval(fetchData, 5000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel(`command-center-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "days", filter: `room_id=eq.${roomId}` },
        () => fetchData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_blocks" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `room_id=eq.${roomId}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, roomId, supabase]);

  const confirmedActivities = activities.filter((activity) => activity.status === "CONFIRMED");
  const openPolls = polls.filter((poll) => poll.status === "OPEN").length;
  const completedTasks = tasks.filter((task) => task.is_completed).length;
  const highPriorityOpenTasks = tasks.filter(
    (task) => task.priority === "HIGH" && !task.is_completed,
  ).length;
  const allocated = activities
    .filter((activity) => activity.status !== "CANCELLED")
    .reduce((sum, activity) => sum + (activity.cost || 0), 0);
  const remaining = roomBudgetCap - allocated;
  const budgetHealth = roomBudgetCap > 0 ? Math.max(0, Math.round((remaining / roomBudgetCap) * 100)) : 100;
  const taskHealth = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 100;
  const activityHealth = activities.length > 0
    ? Math.round((confirmedActivities.length / activities.length) * 100)
    : 0;
  const readiness = Math.round((budgetHealth + taskHealth + activityHealth) / 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6 text-brand-500" />
        <span className="ml-2 text-sm text-slate-500">Loading command center...</span>
      </div>
    );
  }

  return (
    <section className="space-y-5" data-testid="command-center-view">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard testId="readiness-score" label="Readiness" value={`${readiness}%`} tone={readiness >= 70 ? "emerald" : readiness >= 40 ? "amber" : "red"} />
        <MetricCard testId="command-open-polls" label="Open Polls" value={openPolls.toString()} tone={openPolls > 0 ? "blue" : "slate"} />
        <MetricCard testId="command-task-progress" label="Tasks Done" value={`${completedTasks}/${tasks.length}`} tone={highPriorityOpenTasks ? "amber" : "emerald"} />
        <MetricCard testId="command-budget-health" label="Remaining" value={formatCurrency(remaining)} tone={remaining < 0 ? "red" : "emerald"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="card overflow-hidden" data-testid="room-health-board">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Live Verification Board
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <HealthRow label="Itinerary days created" value={`${days.length} day${days.length === 1 ? "" : "s"}`} complete={days.length > 0} />
            <HealthRow label="Activity blocks planned" value={`${activities.length} block${activities.length === 1 ? "" : "s"}`} complete={activities.length > 0} />
            <HealthRow label="Confirmed activities" value={`${confirmedActivities.length}/${activities.length}`} complete={activities.length > 0 && confirmedActivities.length > 0} />
            <HealthRow label="Room to-do list coverage" value={`${tasks.length} task${tasks.length === 1 ? "" : "s"}`} complete={tasks.length > 0} />
            <HealthRow label="Voting decisions" value={`${polls.length} poll${polls.length === 1 ? "" : "s"}`} complete={polls.length > 0} />
            <HealthRow label="Budget guardrail" value={remaining < 0 ? "Exceeded" : "Within cap"} complete={remaining >= 0} />
          </div>
        </section>

        <section className="card p-5" data-testid="permission-matrix">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Permission Matrix
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Current access: {role}
              </p>
            </div>
            <Badge variant="role" value={role}>
              {role}
            </Badge>
          </div>
          <div className="space-y-3">
            {participants.map((participant) => {
              const name = participant.profile?.name || "Unknown participant";
              return (
                <article
                  key={participant.id}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                  data-testid={`permission-user-${participant.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {name}
                    </p>
                    <Badge variant="role" value={participant.role}>
                      {participant.role}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {roleCapabilities[participant.role].map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

function MetricCard({
  testId,
  label,
  value,
  tone,
}: {
  testId: string;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "red" | "blue" | "slate";
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    blue: "text-blue-600 dark:text-blue-400",
    slate: "text-slate-700 dark:text-slate-200",
  };
  const valueFontSizeRem = Math.max(
    0.45,
    Math.min(1.875, 18 / Math.max(value.length, 8)),
  );

  return (
    <div className="card min-w-0 p-4" data-testid={testId}>
      <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 block max-w-full whitespace-nowrap font-bold leading-tight ${toneClasses[tone]}`}
        style={{ fontSize: `${valueFontSizeRem}rem` }}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function HealthRow({
  label,
  value,
  complete,
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            complete
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
          }`}
          aria-hidden="true"
        >
          {complete ? "✓" : "!"}
        </span>
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {label}
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {value}
      </span>
    </div>
  );
}
