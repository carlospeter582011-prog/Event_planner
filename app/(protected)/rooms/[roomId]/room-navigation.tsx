"use client";

type RoomTab = "timeline" | "tasks" | "budget";

interface RoomNavigationProps {
  activeTab: RoomTab;
  onTabChange: (tab: RoomTab) => void;
  counts: {
    participants: number;
  };
}

const tabs: { id: RoomTab; label: string; description: string }[] = [
  {
    id: "timeline",
    label: "Timeline",
    description: "Days and activity blocks",
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Delegation checklist",
  },
  {
    id: "budget",
    label: "Budget",
    description: "Cap and allocation",
  },
];

export type { RoomTab };

export default function RoomNavigation({
  activeTab,
  onTabChange,
  counts,
}: RoomNavigationProps) {
  return (
    <nav
      className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      role="tablist"
      aria-label="Room workspace sections"
      data-testid="room-navigation"
    >
      <div className="grid gap-1 sm:grid-cols-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            data-testid={`tab-${tab.id}`}
            className={`min-h-16 rounded-md px-3 py-2 text-left transition-colors ${
              activeTab === tab.id
                ? "bg-brand-50 text-brand-900 dark:bg-brand-950/40 dark:text-brand-100"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
          >
            <span className="block text-sm font-semibold">{tab.label}</span>
            <span className="mt-0.5 block text-xs opacity-80">
              {tab.description}
            </span>
          </button>
        ))}
      </div>
      <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span data-testid="nav-participant-count">
          {counts.participants} participant{counts.participants === 1 ? "" : "s"} in room
        </span>
      </div>
    </nav>
  );
}
