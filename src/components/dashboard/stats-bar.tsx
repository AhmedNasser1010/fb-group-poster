"use client"

import { CheckCircle2, CircleDashed, Layers, Users } from "lucide-react"
import type { PostStatus } from "@/lib/types"

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  tone: "primary" | "success" | "muted" | "danger"
}) {
  const tones: Record<typeof tone, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-emerald-600 bg-emerald-600/10",
    muted: "text-muted-foreground bg-muted",
    danger: "text-destructive bg-destructive/10",
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className={`flex size-9 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export function StatsBar({
  totalGroups,
  postedCount,
  errors,
  totalMembers,
  loading,
}: {
  totalGroups: number
  postedCount: number
  errors: number
  totalMembers: number
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
    )
  }

  const formatMembers = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Groups loaded"
        value={String(totalGroups)}
        icon={Layers}
        tone="primary"
      />
      <StatCard
        label="Marked posted"
        value={String(postedCount)}
        icon={CheckCircle2}
        tone="success"
      />
      <StatCard
        label="Remaining"
        value={String(Math.max(totalGroups - postedCount, 0))}
        icon={CircleDashed}
        tone="muted"
      />
      <StatCard
        label="Total reach"
        value={formatMembers(totalMembers)}
        icon={Users}
        tone={errors > 0 ? "danger" : "muted"}
      />
    </div>
  )
}

export function lastRunErrors(postStatuses: Record<string, PostStatus>): number {
  return Object.values(postStatuses).filter((s) => s.status === "error").length
}
