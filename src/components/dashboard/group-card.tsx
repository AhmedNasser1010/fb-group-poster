"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Globe,
  Lock,
  RefreshCw,
  Send,
  Copy,
  ExternalLink,
  EyeOff,
  Eye,
  StickyNote,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Group, PostStatus } from "@/lib/types"

export function parseMemberCount(count: string): number {
  const match = count.replace(/,/g, "").match(/([\d.]+)\s*([KkMm])?/)
  if (!match) return 0
  const value = parseFloat(match[1])
  if (Number.isNaN(value)) return 0
  const suffix = match[2]?.toLowerCase()
  if (suffix === "k") return value * 1_000
  if (suffix === "m") return value * 1_000_000
  return value
}

function PrivacyBadge({ privacy }: { privacy: Group["privacy"] }) {
  if (privacy === "public") {
    return (
      <Badge variant="outline" className="gap-1 text-emerald-600">
        <Globe className="size-3" />
        Public
      </Badge>
    )
  }
  if (privacy === "private") {
    return (
      <Badge variant="outline" className="gap-1 text-amber-600">
        <Lock className="size-3" />
        Private
      </Badge>
    )
  }
  return <Badge variant="outline">Unknown</Badge>
}

function StatusIndicator({ status }: { status?: PostStatus }) {
  if (!status || status.status === "idle") return null
  if (status.status === "loading") {
    return (
      <Badge variant="secondary" className="gap-1">
        <RefreshCw className="animate-spin" />
        Posting…
      </Badge>
    )
  }
  if (status.status === "success") {
    return (
      <Badge className="gap-1 bg-emerald-600 text-white">
        <Check className="size-3" />
        Posted
      </Badge>
    )
  }
  return <Badge variant="destructive">Failed</Badge>
}

async function copyUrl(group: Group) {
  try {
    await navigator.clipboard.writeText(group.url)
    toast.success("Group URL copied")
  } catch {
    toast.error("Failed to copy URL")
  }
}
export function GroupCard({
  group,
  index,
  posted,
  onTogglePosted,
  status,
  isSelected,
  disabled,
  onPost,
  note,
  onNoteChange,
  hidden,
  onToggleHidden,
}: {
  group: Group
  index: number
  posted: boolean
  onTogglePosted: () => void
  status?: PostStatus
  isSelected: boolean
  disabled: boolean
  onPost: () => void
  note: string
  onNoteChange: (value: string) => void
  hidden: boolean
  onToggleHidden: () => void
}) {
  const [noteOpen, setNoteOpen] = React.useState(false)
  const hasError = status?.status === "error"

  return (
    <div
      className={
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md " +
        (isSelected ? "border-primary/60 ring-1 ring-primary/30 " : "") +
        (posted ? "border-emerald-600/40 " : "") +
        (hasError ? "border-destructive/40 " : "")
      }
    >
      {status?.status === "success" && (
        <div className="absolute inset-y-0 left-0 w-0.5 bg-emerald-500" />
      )}
      {hasError && (
        <div className="absolute inset-y-0 left-0 w-0.5 bg-destructive" />
      )}

      <div className="flex items-start gap-3">
        <Avatar className="size-10 shrink-0 ring-1 ring-border">
          <AvatarImage src={group.logoUrl} />
          <AvatarFallback>{group.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-snug" title={group.name}>
            {group.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <PrivacyBadge privacy={group.privacy} />
            <span className="text-xs text-muted-foreground">
              {group.memberCount} members
            </span>
          </div>
        </div>

        <label
          className="flex shrink-0 cursor-pointer items-center"
          title={posted ? "Mark as not posted" : "Mark as posted"}
        >
          <input
            type="checkbox"
            checked={posted}
            onChange={onTogglePosted}
            className="size-4 cursor-pointer accent-primary"
            aria-label={`Mark ${group.name} as posted`}
          />
        </label>
      </div>

      {status && status.status !== "idle" && (
        <div className="mt-3">
          <StatusIndicator status={status} />
          {hasError && status.message && (
            <p className="mt-1 line-clamp-2 text-xs text-destructive" title={status.message}>
              {status.message}
            </p>
          )}
        </div>
      )}

      {noteOpen && (
        <Input
          className="mt-3 h-8 text-xs"
          placeholder="Add note..."
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          aria-label={`Note for ${group.name}`}
          autoFocus
        />
      )}

      <div className="mt-4 flex gap-1.5 border-t pt-3">
        <Button
          className="flex-1"
          size="sm"
          onClick={onPost}
          disabled={disabled || status?.status === "loading"}
        >
          {status?.status === "loading" ? (
            <RefreshCw className="animate-spin" />
          ) : (
            <Send />
          )}
          Post
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={note || noteOpen ? "Edit note" : "Add note"}
          aria-label={`Toggle note for ${group.name}`}
          onClick={() => setNoteOpen((v) => !v)}
        >
          <StickyNote className={note ? "fill-amber-400 text-amber-500" : ""} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Copy direct group URL"
          aria-label={`Copy direct URL for ${group.name}`}
          onClick={() => copyUrl(group)}
        >
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Open group in new tab"
          aria-label={`Open ${group.name} in a new tab`}
          onClick={() => window.open(group.url, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={hidden ? "Unhide group" : "Hide group"}
          aria-label={hidden ? `Unhide ${group.name}` : `Hide ${group.name}`}
          onClick={onToggleHidden}
        >
          {hidden ? <Eye /> : <EyeOff />}
        </Button>
      </div>

      <span className="absolute right-3 top-3 text-[10px] tabular-nums text-muted-foreground/50">
        #{index}
      </span>
    </div>
  )
}

export function GroupListItem({
  group,
  index,
  posted,
  onTogglePosted,
  status,
  isSelected,
  disabled,
  onPost,
  note,
  onNoteChange,
  hidden,
  onToggleHidden,
}: {
  group: Group
  index: number
  posted: boolean
  onTogglePosted: () => void
  status?: PostStatus
  isSelected: boolean
  disabled: boolean
  onPost: () => void
  note: string
  onNoteChange: (value: string) => void
  hidden: boolean
  onToggleHidden: () => void
}) {
  return (
    <div
      className={
        "flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm transition-all hover:shadow-md " +
        (isSelected ? "border-primary/60 ring-1 ring-primary/30 " : "") +
        (status?.status === "success" ? "border-emerald-600/40 " : "")
      }
    >
      <span className="hidden w-8 shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
        #{index}
      </span>
      <Avatar className="size-9 shrink-0 ring-1 ring-border">
        <AvatarImage src={group.logoUrl} />
        <AvatarFallback className="text-sm">
          {group.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={group.name}>
          {group.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <PrivacyBadge privacy={group.privacy} />
          <span className="text-xs text-muted-foreground">
            {group.memberCount} members
          </span>
          <StatusIndicator status={status} />
        </div>
        {status?.status === "error" && status.message && (
          <p className="mt-1 truncate text-xs text-destructive" title={status.message}>
            {status.message}
          </p>
        )}
      </div>

      <Input
        className="hidden h-8 w-40 text-xs lg:block"
        placeholder="Note..."
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        aria-label={`Note for ${group.name}`}
      />

      <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={posted}
          onChange={onTogglePosted}
          className="size-4 cursor-pointer accent-primary"
          aria-label={`Mark ${group.name} as posted`}
        />
        <span className="hidden text-xs text-muted-foreground md:inline">Posted</span>
      </label>

      <Button
        size="sm"
        onClick={onPost}
        disabled={disabled || status?.status === "loading"}
        className="shrink-0"
      >
        {status?.status === "loading" ? (
          <RefreshCw className="animate-spin" />
        ) : (
          <Send />
        )}
        Post
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        title={hidden ? "Unhide group" : "Hide group"}
        aria-label={hidden ? `Unhide ${group.name}` : `Hide ${group.name}`}
        onClick={onToggleHidden}
        className="shrink-0"
      >
        {hidden ? <Eye /> : <EyeOff />}
      </Button>
    </div>
  )
}
