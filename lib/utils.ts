import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as USD currency. */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

/** Format an ISO timestamp as a human-readable date/time. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "Not set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Format an ISO date as a short date (e.g. "Jul 5, 2026"). */
export function formatDate(iso: string | null): string {
  if (!iso) return "No date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format an ISO timestamp as a time only (e.g. "2:30 PM"). */
export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Get initials from a display name (max 2 chars). */
export function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Compute the next fractional order_index for drag-and-drop positioning.
 * Uses fractional indexing so we never have to rewrite siblings.
 */
export function midpoint(a: number, b: number): number {
  return (a + b) / 2;
}

/** Generate a URL-safe random slug. */
export function generateSlug(): string {
  // crypto.randomUUID is available in Node 19+ and modern browsers
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Extract a room id/slug from a raw code, /rooms URL, or /join?slug URL. */
export function parseRoomIdentifier(value: string): string {
  const raw = value.trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const querySlug = url.searchParams.get("slug");
    if (querySlug) return querySlug.trim();

    const parts = url.pathname.split("/").filter(Boolean);
    const roomsIndex = parts.indexOf("rooms");
    if (roomsIndex >= 0 && parts[roomsIndex + 1]) {
      return decodeURIComponent(parts[roomsIndex + 1]).trim();
    }

    return decodeURIComponent(parts[parts.length - 1] ?? "").trim();
  } catch {
    return raw.replace(/^\/?rooms\//, "").split(/[?#]/)[0].trim();
  }
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
