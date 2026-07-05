"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import toast from "react-hot-toast";
import type { Role } from "@/types";

interface ChatViewProps {
  roomId: string;
  userId: string;
  role: Role;
}

interface MessageRow {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: {
    name: string;
    email: string;
  } | null;
}

export default function ChatView({ roomId, userId, role }: ChatViewProps) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("room_messages")
      .select("id, room_id, user_id, body, created_at, profile:profiles(name, email)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      setSchemaMissing(error.message.toLowerCase().includes("room_messages"));
      setLoading(false);
      return;
    }

    setSchemaMissing(false);
    setMessages((data as unknown as MessageRow[] | null) ?? []);
    setLoading(false);
  }, [roomId, supabase]);

  useEffect(() => {
    fetchMessages();
    const interval = window.setInterval(fetchMessages, 5000);
    return () => window.clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    const channel = supabase
      .channel(`room-chat-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        () => fetchMessages(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, roomId, supabase]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setSaving(true);
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: userId,
      body: body.trim(),
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setBody("");
    fetchMessages();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6 text-brand-500" />
        <span className="ml-2 text-sm text-slate-500">Loading chat...</span>
      </div>
    );
  }

  if (schemaMissing) {
    return (
      <div
        className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        role="alert"
        data-testid="chat-schema-warning"
      >
        Room chat needs the `room_messages` SQL table. Run the chat SQL patch,
        then refresh this room.
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="chat-view">
      <div className="card max-h-96 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500" data-testid="empty-chat">
            No messages yet.
          </p>
        ) : (
          <div className="space-y-3" data-testid="chat-message-list">
            {messages.map((message) => {
              const own = message.user_id === userId;
              return (
                <article
                  key={message.id}
                  className={`rounded-lg border px-3 py-2 ${
                    own
                      ? "border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}
                  data-testid={`chat-message-${message.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-500">
                      {message.profile?.name || message.profile?.email || role}
                    </p>
                    <time className="text-xs text-slate-400">
                      {new Date(message.created_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900 dark:text-white">
                    {message.body}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="card flex gap-2 p-3" data-testid="chat-form">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="input"
          placeholder="Message the room..."
          maxLength={500}
          data-testid="chat-input"
        />
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="btn-primary shrink-0"
          data-testid="chat-send"
        >
          {saving ? <Spinner className="h-4 w-4" /> : "Send"}
        </button>
      </form>
    </section>
  );
}
