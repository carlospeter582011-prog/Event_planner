"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import Modal from "@/components/ui/modal";
import type { Role, ActivityStatus } from "@/types";

interface BudgetViewProps {
  roomId: string;
  role: Role;
  roomBudgetCap: number;
}

interface ActivityRow {
  id: string;
  title: string;
  status: ActivityStatus;
  cost: number;
}

export default function BudgetView({
  roomId,
  role,
  roomBudgetCap,
}: BudgetViewProps) {
  const supabase = createClient();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editBudgetOpen, setEditBudgetOpen] = useState(false);
  const [newBudget, setNewBudget] = useState(roomBudgetCap.toString());

  const isHost = role === "HOST";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("activity_blocks")
      .select("id, title, status, cost");
    setActivities((data as ActivityRow[] | null) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("budget-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_blocks" },
        () => fetchData(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchData]);

  // Save budget cap
  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("rooms")
      .update({ total_budget_cap: parseFloat(newBudget) || 0 })
      .eq("id", roomId);
    if (error) { toast.error(error.message); return; }
    toast.success("Budget updated!");
    setEditBudgetOpen(false);
  }

  // Calculations
  const confirmedTotal = activities
    .filter((a) => a.status === "CONFIRMED")
    .reduce((sum, a) => sum + (a.cost || 0), 0);

  const proposedTotal = activities
    .filter((a) => a.status === "PROPOSED")
    .reduce((sum, a) => sum + (a.cost || 0), 0);

  const totalAllocated = confirmedTotal + proposedTotal;
  const remaining = roomBudgetCap - totalAllocated;
  const isOverBudget = totalAllocated > roomBudgetCap;
  const usagePercent = roomBudgetCap > 0
    ? Math.min((totalAllocated / roomBudgetCap) * 100, 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6 text-brand-500" />
        <span className="ml-2 text-sm text-slate-500">Loading budget…</span>
      </div>
    );
  }

  return (
    <div data-testid="budget-view">
      {/* Budget violation warning */}
      {isOverBudget && (
        <div
          className="mb-6 flex items-center gap-3 rounded-xl border-2 border-red-300 bg-red-50 px-5 py-4 dark:border-red-800 dark:bg-red-950/40"
          role="alert"
          data-testid="budget-warning"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400" aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-300">
              Budget exceeded!
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400">
              Total allocated costs ({formatCurrency(totalAllocated)}) exceed the budget cap ({formatCurrency(roomBudgetCap)}).
              Consider increasing the budget or reducing activity costs.
            </p>
          </div>
        </div>
      )}

      {/* Budget cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BudgetCard
          testId="budget-cap"
          label="Total Budget Cap"
          value={formatCurrency(roomBudgetCap)}
          color="brand"
        />
        <BudgetCard
          testId="budget-allocated"
          label="Total Allocated"
          value={formatCurrency(totalAllocated)}
          color={isOverBudget ? "red" : "blue"}
        />
        <BudgetCard
          testId="budget-confirmed"
          label="Confirmed"
          value={formatCurrency(confirmedTotal)}
          color="emerald"
        />
        <BudgetCard
          testId="budget-remaining"
          label="Remaining"
          value={formatCurrency(remaining)}
          color={remaining >= 0 ? "emerald" : "red"}
        />
      </div>

      {/* Usage bar */}
      <div className="mt-6 card p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Budget usage
          </span>
          <span className="text-slate-500">{usagePercent.toFixed(1)}%</span>
        </div>
        <div className="h-4 w-full rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={usagePercent} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`h-4 rounded-full transition-all ${
              isOverBudget
                ? "bg-red-500"
                : usagePercent > 80
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${usagePercent}%` }}
            data-testid="budget-usage-bar"
          />
        </div>
        <div className="mt-3 flex justify-between text-xs text-slate-500">
          <span>{formatCurrency(0)}</span>
          <span>{formatCurrency(roomBudgetCap)}</span>
        </div>
      </div>

      {/* Activity breakdown */}
      <div className="mt-6 card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Activity Cost Breakdown
          </h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {activities.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              No activities with costs yet.
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between px-5 py-3"
                data-testid={`budget-activity-${act.id}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {act.title}
                  </span>
                  <Badge variant="status" value={act.status}>
                    {act.status}
                  </Badge>
                </div>
                <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">
                  {formatCurrency(act.cost)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit budget button (Host only) */}
      {isHost && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => {
              setNewBudget(roomBudgetCap.toString());
              setEditBudgetOpen(true);
            }}
            className="btn-secondary text-sm"
            data-testid="btn-edit-budget"
          >
            Edit budget cap
          </button>
        </div>
      )}

      {/* Edit Budget Modal */}
      <Modal open={editBudgetOpen} onClose={() => setEditBudgetOpen(false)} title="Edit Budget Cap">
        <form onSubmit={handleSaveBudget} data-testid="edit-budget-form">
          <div>
            <label htmlFor="budget-cap" className="label">
              Total budget cap ($)
            </label>
            <input
              id="budget-cap"
              name="total_budget_cap"
              type="number"
              min="0"
              step="0.01"
              required
              value={newBudget}
              onChange={(e) => setNewBudget(e.target.value)}
              className="input"
              data-testid="edit-budget-input"
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setEditBudgetOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function BudgetCard({
  testId,
  label,
  value,
  color,
}: {
  testId: string;
  label: string;
  value: string;
  color: "brand" | "blue" | "emerald" | "red" | "amber";
}) {
  const colorMap: Record<string, string> = {
    brand: "text-brand-600",
    blue: "text-blue-600",
    emerald: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
  };

  return (
    <div className="card p-4" data-testid={testId}>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${colorMap[color]} dark:text-${color}-400`}>
        {value}
      </p>
    </div>
  );
}
