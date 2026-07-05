"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import Modal from "@/components/ui/modal";
import { formatCurrency, formatDate, formatTime, midpoint } from "@/lib/utils";
import type { Role, ActivityStatus, PollStatus, RoomPermissions } from "@/types";
import CommentsPanel from "./comments-panel";

interface TimelineViewProps {
  roomId: string;
  role: Role;
  userId: string;
  permissions: RoomPermissions;
}

interface DayRow {
  id: string;
  room_id: string;
  date: string;
  title: string;
  sequence_order: number;
}

interface ActivityRow {
  id: string;
  day_id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  cost: number;
  location: string | null;
  status: ActivityStatus;
  order_index: number;
}

interface VoteRow {
  id: string;
  user_id: string;
}

interface PollOptionRow {
  id: string;
  poll_id: string;
  option_text: string;
  sequence: number;
  votes: VoteRow[];
}

interface PollRow {
  id: string;
  activity_block_id: string;
  question: string;
  status: PollStatus;
  options: PollOptionRow[];
}

export default function TimelineView({
  roomId,
  role,
  userId,
  permissions,
}: TimelineViewProps) {
  const supabase = useMemo(() => createClient(), []);
  const [days, setDays] = useState<DayRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutationLoading, setMutationLoading] = useState<string | null>(null);
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [newDayTitle, setNewDayTitle] = useState("");
  const [newDayDate, setNewDayDate] = useState("");
  const [activityModal, setActivityModal] = useState<{
    open: boolean;
    dayId: string;
    editId?: string;
    initial?: Partial<ActivityRow>;
  }>({ open: false, dayId: "" });
  const [pollModal, setPollModal] = useState<{
    open: boolean;
    activityId: string;
    activityTitle: string;
  }>({ open: false, activityId: "", activityTitle: "" });
  const [pollQuestion, setPollQuestion] = useState("Which option should we choose?");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const canEdit = permissions.manage_itinerary;
  const canDelete = permissions.delete_items;
  const canCreatePoll = permissions.manage_polls;
  const canResolvePoll = permissions.resolve_polls;
  const canVote = permissions.vote;

  // Fetch days and activities
  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const { data: daysData } = await supabase
      .from("days")
      .select("*")
      .eq("room_id", roomId)
      .order("sequence_order", { ascending: true });

    const { data: actData } = await supabase
      .from("activity_blocks")
      .select("*")
      .in(
        "day_id",
        (daysData as DayRow[] | null)?.map((d) => d.id) ?? [],
      )
      .order("order_index", { ascending: true });

    const activityIds = (actData as ActivityRow[] | null)?.map((a) => a.id) ?? [];
    const { data: pollData } = activityIds.length > 0
      ? await supabase
          .from("polls")
          .select(
            "id, activity_block_id, question, status, options:poll_options(id, poll_id, option_text, sequence, votes(id, user_id))",
          )
          .in("activity_block_id", activityIds)
      : { data: [] };

    setDays((daysData as DayRow[] | null) ?? []);
    setActivities((actData as ActivityRow[] | null) ?? []);
    setPolls(((pollData as unknown as PollRow[] | null) ?? []).map((poll) => ({
      ...poll,
      options: [...(poll.options ?? [])].sort((a, b) => a.sequence - b.sequence),
    })));
    if (showLoader) setLoading(false);
  }, [roomId, supabase]);

  useEffect(() => {
    fetchData(true);
    const interval = window.setInterval(fetchData, 5000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  // Realtime subscriptions
  useEffect(() => {
    const daysChannel = supabase
      .channel("days-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "days", filter: `room_id=eq.${roomId}` },
        () => fetchData(),
      )
      .subscribe();

    const actChannel = supabase
      .channel("activities-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_blocks" },
        () => fetchData(),
      )
      .subscribe();

    const pollChannel = supabase
      .channel("polls-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "polls" },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_options" },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => fetchData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(daysChannel);
      supabase.removeChannel(actChannel);
      supabase.removeChannel(pollChannel);
    };
  }, [roomId, supabase, fetchData]);

  // Add day
  async function handleAddDay(e: React.FormEvent) {
    e.preventDefault();
    if (!newDayDate) return;
    const maxOrder = days.length > 0 ? Math.max(...days.map((d) => d.sequence_order)) : 0;
    const { error } = await supabase.from("days").insert({
      room_id: roomId,
      date: new Date(newDayDate).toISOString(),
      title: newDayTitle || `Day ${days.length + 1}`,
      sequence_order: maxOrder + 1,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Day added!");
    setAddDayOpen(false);
    setNewDayTitle("");
    setNewDayDate("");
  }

  // Delete day
  async function handleDeleteDay(dayId: string) {
    const { error } = await supabase.from("days").delete().eq("id", dayId);
    if (error) { toast.error(error.message); return; }
    toast.success("Day removed");
  }

  // Save activity (create or update)
  async function handleSaveActivity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      day_id: activityModal.dayId,
      title: formData.get("title") as string,
      description: formData.get("description") as string || null,
      start_time: formData.get("start_time") ? new Date(formData.get("start_time") as string).toISOString() : null,
      end_time: formData.get("end_time") ? new Date(formData.get("end_time") as string).toISOString() : null,
      cost: parseFloat(formData.get("cost") as string) || 0,
      location: formData.get("location") as string || null,
      status: (formData.get("status") as ActivityStatus) || "PROPOSED",
    };

    if (activityModal.editId) {
      const { error } = await supabase
        .from("activity_blocks")
        .update(payload)
        .eq("id", activityModal.editId);
      if (error) { toast.error(error.message); return; }
      toast.success("Activity updated!");
    } else {
      const dayActs = activities.filter((a) => a.day_id === activityModal.dayId);
      const maxOrder = dayActs.length > 0 ? Math.max(...dayActs.map((a) => a.order_index)) : 0;
      const { error } = await supabase
        .from("activity_blocks")
        .insert({ ...payload, order_index: maxOrder + 1 });
      if (error) { toast.error(error.message); return; }
      toast.success("Activity added!");
    }

    setActivityModal({ open: false, dayId: "" });
  }

  // Delete activity
  async function handleDeleteActivity(actId: string) {
    const { error } = await supabase.from("activity_blocks").delete().eq("id", actId);
    if (error) { toast.error(error.message); return; }
    toast.success("Activity removed");
  }

  async function handleCreatePoll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);

    if (options.length < 2) {
      toast.error("Add at least 2 poll options.");
      return;
    }

    setMutationLoading("create-poll");
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({
        activity_block_id: pollModal.activityId,
        question: pollQuestion.trim() || "Which option should we choose?",
        status: "OPEN",
      })
      .select("id")
      .single();

    if (pollError || !poll) {
      toast.error(pollError?.message ?? "Failed to create poll.");
      setMutationLoading(null);
      return;
    }

    const { error: optionError } = await supabase.from("poll_options").insert(
      options.map((option, index) => ({
        poll_id: (poll as { id: string }).id,
        option_text: option,
        sequence: index + 1,
      })),
    );

    setMutationLoading(null);

    if (optionError) {
      toast.error(optionError.message);
      return;
    }

    toast.success("Poll created.");
    setPollModal({ open: false, activityId: "", activityTitle: "" });
    setPollQuestion("Which option should we choose?");
    setPollOptions(["", ""]);
  }

  async function handleVote(poll: PollRow, option: PollOptionRow) {
    if (poll.status !== "OPEN" || !canVote) return;
    setMutationLoading(`vote-${option.id}`);
    const existingVote = poll.options
      .flatMap((item) => item.votes)
      .find((vote) => vote.user_id === userId);

    const { error } = existingVote
      ? await supabase
          .from("votes")
          .update({ poll_option_id: option.id })
          .eq("id", existingVote.id)
      : await supabase.from("votes").insert({
          poll_option_id: option.id,
          user_id: userId,
        });

    setMutationLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vote saved.");
  }

  async function handleResolvePoll(
    activity: ActivityRow,
    poll: PollRow,
    option: PollOptionRow,
  ) {
    if (!canResolvePoll) return;
    setMutationLoading(`resolve-${poll.id}`);

    const { error: pollError } = await supabase
      .from("polls")
      .update({ status: "CLOSED", closed_at: new Date().toISOString() })
      .eq("id", poll.id);

    if (pollError) {
      toast.error(pollError.message);
      setMutationLoading(null);
      return;
    }

    const { error: activityError } = await supabase
      .from("activity_blocks")
      .update({
        title: option.option_text,
        status: "CONFIRMED",
      })
      .eq("id", activity.id);

    setMutationLoading(null);
    if (activityError) {
      toast.error(activityError.message);
      return;
    }
    toast.success("Poll resolved and activity confirmed.");
  }

  // Drag & Drop handlers
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ dayId: string; index: number } | null>(null);

  function handleDragStart(e: React.DragEvent, actId: string) {
    setDragId(actId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, dayId: string, index: number) {
    e.preventDefault();
    setDropTarget({ dayId, index });
  }

  function handleDragEnd() {
    setDragId(null);
    setDropTarget(null);
  }

  async function handleDrop(targetDayId: string, targetIndex: number) {
    if (!dragId || dragId === activities.find((a) => a.day_id === targetDayId)?.id) {
      setDragId(null);
      setDropTarget(null);
      return;
    }

    const targetDayActs = activities.filter((a) => a.day_id === targetDayId).sort((a, b) => a.order_index - b.order_index);

    let newOrder: number;
    if (targetIndex === 0) {
      newOrder = targetDayActs.length > 0 ? targetDayActs[0].order_index - 1 : 0;
    } else if (targetIndex >= targetDayActs.length) {
      newOrder = targetDayActs.length > 0 ? targetDayActs[targetDayActs.length - 1].order_index + 1 : 0;
    } else {
      newOrder = midpoint(targetDayActs[targetIndex - 1].order_index, targetDayActs[targetIndex].order_index);
    }

    const { error } = await supabase
      .from("activity_blocks")
      .update({ day_id: targetDayId, order_index: newOrder })
      .eq("id", dragId);

    if (error) toast.error(error.message);
    setDragId(null);
    setDropTarget(null);
  }

  if (loading) return <PageLoader />;

  return (
    <div data-testid="timeline-view">
      <div className="mb-4">
        <CommentsPanel
          roomId={roomId}
          userId={userId}
          permissions={permissions}
          targetType="TIMELINE"
          title="Timeline comments"
        />
      </div>
      {/* Add Day button */}
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setAddDayOpen(true)}
            className="btn-primary text-sm"
            data-testid="btn-add-day"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Day
          </button>
        </div>
      )}

      {/* Days list */}
      {days.length === 0 ? (
        <EmptyState
          testId="empty-days"
          title="No days yet"
          description="Add your first day to start building the itinerary."
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-6">
          {days.map((day) => {
            const dayActs = activities
              .filter((a) => a.day_id === day.id)
              .sort((a, b) => a.order_index - b.order_index);

            return (
              <div key={day.id} className="card overflow-hidden" data-testid={`day-${day.id}`}>
                {/* Day header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {day.title}
                    </h3>
                    <p className="text-xs text-slate-500">{formatDate(day.date)}</p>
                  </div>
                  <div className="flex gap-2">
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setActivityModal({ open: true, dayId: day.id })
                          }
                          className="btn-secondary text-xs py-1.5 px-3"
                          data-testid={`btn-add-activity-${day.id}`}
                        >
                          Add activity
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDay(day.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                          data-testid={`btn-delete-day-${day.id}`}
                        >
                          Remove day
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Activity blocks */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dayActs.length === 0 ? (
                    <div className="px-5 py-6 text-center text-sm text-slate-400">
                      No activities yet.
                    </div>
                  ) : (
                    dayActs.map((act, idx) => (
                      (() => {
                        const poll = polls.find((item) => item.activity_block_id === act.id);
                        return (
                      <div
                        key={act.id}
                        draggable={canEdit}
                        onDragStart={(e) => handleDragStart(e, act.id)}
                        onDragOver={(e) => handleDragOver(e, day.id, idx)}
                        onDrop={() => handleDrop(day.id, idx)}
                        onDragEnd={handleDragEnd}
                        className={`group flex items-start gap-4 px-5 py-3 transition-colors ${
                          dropTarget?.dayId === day.id && dropTarget?.index === idx
                            ? "border-t-2 border-brand-500 bg-brand-50/50 dark:bg-brand-950/20"
                            : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                        } ${dragId === act.id ? "opacity-50" : ""}`}
                        data-testid={`activity-${act.id}`}
                      >
                        {/* Drag handle */}
                        {canEdit && (
                          <div className="mt-1 cursor-grab text-slate-300 hover:text-slate-500" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01" />
                            </svg>
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-slate-900 dark:text-white truncate">
                              {act.title}
                            </h4>
                            <Badge variant="status" value={act.status}>
                              {act.status}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {act.start_time && (
                              <span>
                                {formatTime(act.start_time)}
                                {act.end_time ? ` – ${formatTime(act.end_time)}` : ""}
                              </span>
                            )}
                            {act.location && <span>📍 {act.location}</span>}
                            {act.cost > 0 && <span>💰 {formatCurrency(act.cost)}</span>}
                          </div>
                          {act.description && (
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                              {act.description}
                            </p>
                          )}
                          <div className="mt-3">
                            <CommentsPanel
                              roomId={roomId}
                              userId={userId}
                              permissions={permissions}
                              targetType="ACTIVITY"
                              targetId={act.id}
                              title="Activity comments"
                            />
                          </div>
                          {poll ? (
                            <PollPanel
                              activity={act}
                              poll={poll}
                              userId={userId}
                              canVote={canVote}
                              canResolvePoll={canResolvePoll}
                              mutationLoading={mutationLoading}
                              onVote={handleVote}
                              onResolve={handleResolvePoll}
                            />
                          ) : (
                            canCreatePoll && act.status !== "CONFIRMED" && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPollModal({
                                    open: true,
                                    activityId: act.id,
                                    activityTitle: act.title,
                                  })
                                }
                                className="mt-3 rounded-md border border-dashed border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
                                data-testid={`btn-create-poll-${act.id}`}
                              >
                                Create voting poll
                              </button>
                            )
                          )}
                        </div>

                        {/* Actions */}
                        {canEdit && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() =>
                                setActivityModal({
                                  open: true,
                                  dayId: day.id,
                                  editId: act.id,
                                  initial: act,
                                })
                              }
                              className="btn-ghost h-7 w-7 p-0 text-xs"
                              aria-label={`Edit ${act.title}`}
                              data-testid={`btn-edit-activity-${act.id}`}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteActivity(act.id)}
                              className="btn-ghost h-7 w-7 p-0 text-xs text-red-500"
                              aria-label={`Delete ${act.title}`}
                              data-testid={`btn-delete-activity-${act.id}`}
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                        );
                      })()
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Day Modal */}
      <Modal open={addDayOpen} onClose={() => setAddDayOpen(false)} title="Add Day">
        <form onSubmit={handleAddDay} data-testid="add-day-form">
          <div className="space-y-4">
            <div>
              <label htmlFor="day-title" className="label">Day title</label>
              <input
                id="day-title"
                name="title"
                type="text"
                placeholder={`Day ${days.length + 1}`}
                value={newDayTitle}
                onChange={(e) => setNewDayTitle(e.target.value)}
                className="input"
                data-testid="add-day-title"
              />
            </div>
            <div>
              <label htmlFor="day-date" className="label">Date <span className="text-red-500">*</span></label>
              <input
                id="day-date"
                name="date"
                type="date"
                required
                value={newDayDate}
                onChange={(e) => setNewDayDate(e.target.value)}
                className="input"
                data-testid="add-day-date"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setAddDayOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">Add day</button>
          </div>
        </form>
      </Modal>

      {/* Activity Modal (create/edit) */}
      <Modal
        open={activityModal.open}
        onClose={() => setActivityModal({ open: false, dayId: "" })}
        title={activityModal.editId ? "Edit Activity" : "Add Activity"}
      >
        <form onSubmit={handleSaveActivity} data-testid="activity-form">
          <div className="space-y-4">
            <div>
              <label htmlFor="act-title" className="label">Title <span className="text-red-500">*</span></label>
              <input
                id="act-title"
                name="title"
                type="text"
                required
                defaultValue={activityModal.initial?.title ?? ""}
                placeholder="Keynote Presentation"
                className="input"
                data-testid="activity-title"
              />
            </div>
            <div>
              <label htmlFor="act-desc" className="label">Description</label>
              <textarea
                id="act-desc"
                name="description"
                rows={2}
                defaultValue={activityModal.initial?.description ?? ""}
                placeholder="Optional description..."
                className="input resize-none"
                data-testid="activity-desc"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="act-start" className="label">Start time</label>
                <input
                  id="act-start"
                  name="start_time"
                  type="datetime-local"
                  defaultValue={activityModal.initial?.start_time?.slice(0, 16) ?? ""}
                  className="input"
                  data-testid="activity-start"
                />
              </div>
              <div>
                <label htmlFor="act-end" className="label">End time</label>
                <input
                  id="act-end"
                  name="end_time"
                  type="datetime-local"
                  defaultValue={activityModal.initial?.end_time?.slice(0, 16) ?? ""}
                  className="input"
                  data-testid="activity-end"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="act-cost" className="label">Cost ($)</label>
                <input
                  id="act-cost"
                  name="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={activityModal.initial?.cost ?? 0}
                  className="input"
                  data-testid="activity-cost"
                />
              </div>
              <div>
                <label htmlFor="act-location" className="label">Location</label>
                <input
                  id="act-location"
                  name="location"
                  type="text"
                  defaultValue={activityModal.initial?.location ?? ""}
                  placeholder="Main Hall"
                  className="input"
                  data-testid="activity-location"
                />
              </div>
            </div>
            <div>
              <label htmlFor="act-status" className="label">Status</label>
              <select
                id="act-status"
                name="status"
                defaultValue={activityModal.initial?.status ?? "PROPOSED"}
                className="input"
                data-testid="activity-status"
              >
                <option value="PROPOSED">Proposed</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setActivityModal({ open: false, dayId: "" })} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {activityModal.editId ? "Save changes" : "Add activity"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={pollModal.open}
        onClose={() => setPollModal({ open: false, activityId: "", activityTitle: "" })}
        title="Create Voting Poll"
      >
        <form onSubmit={handleCreatePoll} data-testid="create-poll-form">
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Attach alternatives to {pollModal.activityTitle || "this activity"}.
            </p>
            <div>
              <label htmlFor="poll-question" className="label">
                Poll question
              </label>
              <input
                id="poll-question"
                name="question"
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="input"
                data-testid="poll-question"
              />
            </div>
            <div className="space-y-2">
              <label className="label">Options</label>
              {pollOptions.map((option, index) => (
                <input
                  key={index}
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[index] = e.target.value;
                    setPollOptions(next);
                  }}
                  placeholder={index < 2 ? `Required option ${index + 1}` : `Optional option ${index + 1}`}
                  className="input"
                  data-testid={`poll-option-${index + 1}`}
                />
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPollOptions((current) => [...current, ""])}
                  className="btn-secondary px-3 py-1.5 text-xs"
                  data-testid="poll-add-option"
                >
                  Add option
                </button>
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions((current) => current.slice(0, -1))}
                    className="btn-ghost px-3 py-1.5 text-xs"
                    data-testid="poll-remove-option"
                  >
                    Remove last option
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Add at least 2 alternatives. Empty optional fields are ignored.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPollModal({ open: false, activityId: "", activityTitle: "" })}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutationLoading === "create-poll"}
              className="btn-primary"
              data-testid="create-poll-submit"
            >
              {mutationLoading === "create-poll" ? <Spinner className="h-4 w-4" /> : "Create poll"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PollPanel({
  activity,
  poll,
  userId,
  canVote,
  canResolvePoll,
  mutationLoading,
  onVote,
  onResolve,
}: {
  activity: ActivityRow;
  poll: PollRow;
  userId: string;
  canVote: boolean;
  canResolvePoll: boolean;
  mutationLoading: string | null;
  onVote: (poll: PollRow, option: PollOptionRow) => void;
  onResolve: (activity: ActivityRow, poll: PollRow, option: PollOptionRow) => void;
}) {
  const totalVotes = poll.options.reduce((sum, option) => sum + option.votes.length, 0);
  const userVote = poll.options.find((option) =>
    option.votes.some((vote) => vote.user_id === userId),
  );
  const topOption = [...poll.options].sort((a, b) => {
    const voteDelta = b.votes.length - a.votes.length;
    return voteDelta || a.sequence - b.sequence;
  })[0];

  return (
    <section
      className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40"
      data-testid={`poll-${poll.id}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
              {poll.question}
            </h5>
            <Badge variant="poll" value={poll.status}>
              {poll.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {totalVotes} vote{totalVotes === 1 ? "" : "s"}
            {userVote ? ` · Your vote: ${userVote.option_text}` : ""}
          </p>
        </div>
        {canResolvePoll && poll.status === "OPEN" && topOption && (
          <button
            type="button"
            onClick={() => onResolve(activity, poll, topOption)}
            disabled={mutationLoading === `resolve-${poll.id}`}
            className="btn-secondary px-3 py-1.5 text-xs"
            data-testid={`poll-auto-commit-${poll.id}`}
          >
            {mutationLoading === `resolve-${poll.id}` ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              "Commit top choice"
            )}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const votes = option.votes.length;
          const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isSelected = userVote?.id === option.id;

          return (
            <div key={option.id} data-testid={`poll-option-result-${option.id}`}>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onVote(poll, option)}
                  disabled={!canVote || poll.status !== "OPEN" || mutationLoading === `vote-${option.id}`}
                  className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950/30 dark:text-brand-100"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  } disabled:cursor-not-allowed disabled:opacity-70`}
                  data-testid={`poll-vote-${option.id}`}
                >
                  <span className="block truncate font-medium">
                    {option.option_text}
                  </span>
                </button>
                <span className="w-16 text-right text-xs font-medium text-slate-500">
                  {votes} ({percent}%)
                </span>
                {canResolvePoll && poll.status === "OPEN" && (
                  <button
                    type="button"
                    onClick={() => onResolve(activity, poll, option)}
                    disabled={mutationLoading === `resolve-${poll.id}`}
                    className="btn-ghost px-2 py-1 text-xs"
                    data-testid={`poll-commit-${option.id}`}
                  >
                    Commit
                  </button>
                )}
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-1.5 rounded-full bg-brand-500 transition-all"
                  style={{ width: `${percent}%` }}
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  data-testid={`poll-bar-${option.id}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner className="h-6 w-6 text-brand-500" />
      <span className="ml-2 text-sm text-slate-500">Loading timeline…</span>
    </div>
  );
}
