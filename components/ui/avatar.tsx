import { getInitials, cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

/** Circular avatar with initials fallback. */
export function Avatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: AvatarProps) {
  const initials = getInitials(name);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${name}'s avatar`}
        className={cn(
          "rounded-full object-cover ring-2 ring-white dark:ring-slate-900",
          sizeClasses[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-brand-500 font-semibold text-white ring-2 ring-white dark:ring-slate-900",
        sizeClasses[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
