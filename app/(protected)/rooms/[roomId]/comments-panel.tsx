"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import type { RoomPermissions } from "@/types";

type CommentTargetType = "ROOM" | "TIMELINE" | "ACTIVITY" | "BUDGET" | "TASK";

interface CommentsPanelProps {
  roomId: string;
  userId: string;
  permissions: RoomPermissions;
  targetType: CommentTargetType;
  targetId?: string | null;
  title: string;
}

interface CommentRow {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: {
    name: string;
    email?: string;
  } | null;
}

export default function CommentsPanel({
  roomId,
  userId,
  permissions,
  targetType,
  targetId = null,
  title,
}: CommentsPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const fetchComments = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);

    let query = supabase
      .from("room_comments")
      .select("id, user_id, body, created_at, profile:profiles(name, email)")
      .eq("room_id", roomId)
      .eq("target_type", targetType)
      .order("created_at", { ascending: true })
      .limit(50);

    query = targetId ? query.eq("target_id", targetId) : query.is("target_id", null);

    const { data, error } = await query;

    if (error) {
      setSchemaMissing(error.message.toLowerCase().includes("room_comments"));
      if (showLoader) setLoading(false);
      return;
    }

    setSchemaMissing(false);
    setComments((data as unknown as CommentRow[] | null) ?? []);
    if (showLoader) setLoading(false);
  }, [roomId, supabase, targetId, targetType]);

  useEffect(() => {
    fetchComments(true);
    const interval = window.setInterval(fetchComments, 5000);
    return () => window.clearInterval(interval);
  }, [fetchComments]);

  useEffect(() => {
    const channel = supabase
      .channel(`room-comments-${roomId}-${targetType}-${targetId ?? "root"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_comments", filter: `room_id=eq.${roomId}` },
        () => fetchComments(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchComments, roomId, supabase, targetId, targetType]);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setSaving(true);
    setCommentError(null);
    const { error } = await supabase.from("room_comments").insert({
      room_id: roomId,
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
      body: body.trim(),
    });
    setSaving(false);

    if (error) {
      setCommentError(error.message);
      toast.error(error.message);
      return;
    }

    setBody("");
    setCommentError(null);
    fetchComments();
  }

  async function deleteComment(comment: CommentRow) {
    if (comment.user_id !== userId && !permissions.manage_comments) return;

    setDeletingId(comment.id);
    const { error } = await supabase
      .from("room_comments")
      .delete()
      .eq("id", comment.id);
    setDeletingId(null);

    if (error) {
      setCommentError(error.message);
      toast.error(error.message);
      return;
    }

    setCommentError(null);
    toast.success("Comment deleted.");
    fetchComments();
  }

  async function clearComments() {
    if (!permissions.manage_comments) return;

    setClearing(true);
    let query = supabase
      .from("room_comments")
      .delete()
      .eq("room_id", roomId)
      .eq("target_type", targetType);

    query = targetId ? query.eq("target_id", targetId) : query.is("target_id", null);

    const { error } = await query;
    setClearing(false);

    if (error) {
      setCommentError(error.message);
      toast.error(error.message);
      return;
    }

    setCommentError(null);
    toast.success("Comments cleared.");
    fetchComments();
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800">
        Loading comments...
      </div>
    );
  }

  if (schemaMissing) {
    return (
      <div
        className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        role="alert"
      >
        Comments need the `room_comments` SQL patch.
      </div>
    );
  }

  return (
    <section
      className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40"
      data-testid={`comments-${targetType.toLowerCase()}-${targetId ?? "room"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h5 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
          {title}
        </h5>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {comments.length}
          </span>
          {permissions.manage_comments && comments.length > 0 && (
            <button
              type="button"
              onClick={clearComments}
              disabled={clearing}
              className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-60"
              data-testid={`comments-clear-${targetType.toLowerCase()}-${targetId ?? "room"}`}
            >
              {clearing ? "..." : "Clear"}
            </button>
          )}
        </div>
      </div>

      {commentError && (
        <div
          className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
          data-testid={`comment-error-${targetType.toLowerCase()}-${targetId ?? "room"}`}
        >
          {commentError}
        </div>
      )}

      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-xs text-slate-500">No comments yet.</p>
        ) : (
          comments.map((comment) => {
            const canDelete = comment.user_id === userId || permissions.manage_comments;
            return (
              <article
                key={comment.id}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                data-testid={`comment-${comment.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-slate-500">
                    {comment.profile?.name || comment.profile?.email || "Participant"}
                  </p>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteComment(comment)}
                      disabled={deletingId === comment.id}
                      className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-60"
                      data-testid={`comment-delete-${comment.id}`}
                    >
                      {deletingId === comment.id ? "..." : "Delete"}
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
                  {comment.body}
                </p>
              </article>
            );
          })
        )}
      </div>

      <form onSubmit={addComment} className="mt-3 flex gap-2">
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="input"
          maxLength={500}
          placeholder="Write a comment..."
          data-testid={`comment-input-${targetType.toLowerCase()}-${targetId ?? "room"}`}
        />
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="btn-secondary shrink-0 px-3 py-2 text-xs"
          data-testid={`comment-submit-${targetType.toLowerCase()}-${targetId ?? "room"}`}
        >
          {saving ? <Spinner className="h-3.5 w-3.5" /> : "Post"}
        </button>
      </form>
    </section>
  );
}
