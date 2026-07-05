import { cn } from "@/lib/utils";
import type { Role, ActivityStatus, TaskPriority, PollStatus } from "@/types";

const roleStyles: Record<Role, string> = {
  HOST: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  EDITOR:
    "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  VIEWER: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const statusStyles: Record<ActivityStatus, string> = {
  PROPOSED:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  CONFIRMED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELLED:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const priorityStyles: Record<TaskPriority, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  MEDIUM:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  HIGH: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const pollStatusStyles: Record<PollStatus, string> = {
  OPEN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  CLOSED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "role" | "status" | "priority" | "poll";
  value?: Role | ActivityStatus | TaskPriority | PollStatus;
}

export function Badge({
  children,
  className,
  variant = "default",
  value,
}: BadgeProps) {
  let computed = "";

  if (variant === "role" && value) {
    computed = roleStyles[value as Role];
  } else if (variant === "status" && value) {
    computed = statusStyles[value as ActivityStatus];
  } else if (variant === "priority" && value) {
    computed = priorityStyles[value as TaskPriority];
  } else if (variant === "poll" && value) {
    computed = pollStatusStyles[value as PollStatus];
  } else {
    computed =
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        computed,
        className,
      )}
    >
      {children}
    </span>
  );
}
