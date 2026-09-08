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
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type {
  Group,
  GroupFlagAccount,
  GroupFlagId,
  GroupFlagsMap,
  PostStatus,
} from "@/lib/types"
import { Ban, Clock, Flag, Inbox, ThumbsDown, Monitor, Smartphone, X } from "lucide-react"

export interface GroupFlagMeta {
  id: GroupFlagId
  label: string
  badgeClass: string
  icon: React.ComponentType<{ className?: string }>
}

// Registry of group flags. Add new flags here — they will automatically
// appear in the flag dropdown and render as badges on group cards.
export const GROUP_FLAGS: GroupFlagMeta[] = [
  {
    id: "no-reshare",
    label: "No Reshare",
    badgeClass: "text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/40",
    icon: Ban,
  },
  {
    id: "accept-posts",
    label: "Accept Posts",
    badgeClass:
      "text-sky-600 border-sky-300 bg-sky-50 dark:bg-sky-950/40",
    icon: Inbox,
  },
  {
    id: "long-pending",
    label: "Long Pending",
    badgeClass:
      "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40",
    icon: Clock,
  },
  {
    id: "auto-reject",
    label: "Auto Reject",
    badgeClass:
      "text-slate-600 border-slate-300 bg-slate-100 dark:bg-slate-900/60 dark:text-slate-300",
    icon: ThumbsDown,
  },
]

export function GroupFlagsBadges({
  flags,
  onRemove,
  className = "",
}: {
  flags: GroupFlagsMap
  onRemove: (flagId: GroupFlagId) => void
  className?: string
}) {
  if (!flags) return null
  // Page Account flags first, then Personal Account flags
  const entries = GROUP_FLAGS.filter((f) => flags[f.id]).sort(
    (a, b) =>
      (flags[a.id] === "page" ? 0 : 1) - (flags[b.id] === "page" ? 0 : 1)
  )
  if (entries.length === 0) return null
  return (
    <span className={"inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 " + className}>
      {entries.map((flag) => {
        const Icon = flag.icon
        const account = flags[flag.id]
        return (
          <Badge
            key={flag.id}
            variant="outline"
            render={
              <button
                type="button"
                title={`${flag.label} · ${account === "page" ? "Page Account" : "Personal Account"} — click to remove`}
                aria-label={`Remove flag ${flag.label}`}
                onClick={() => onRemove(flag.id)}
                className="cursor-pointer hover:bg-muted/80"
              />
            }
            className={"gap-1 " + flag.badgeClass}
          >
            {flag.label}
            {account === "page" ? (
              <Monitor className="size-3 opacity-70" aria-label="Page Account" />
            ) : (
              <Smartphone className="size-3 opacity-70" aria-label="Personal Account" />
            )}
            <X className="hidden size-3 group-hover/badge:block" aria-hidden />
            <Icon className="size-3 group-hover/badge:hidden" />
          </Badge>
        )
      })}
    </span>
  )
}

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
export function GroupFlagMenuButton({
  flags,
  onSetFlag,
}: {
  flags: GroupFlagsMap
  onSetFlag: (flagId: GroupFlagId, account: GroupFlagAccount) => void
}) {
  const hasFlags = flags && Object.keys(flags).length > 0
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            title="Manage flags"
            aria-label="Manage flags"
          />
        }
      >
        <Flag className={hasFlags ? "fill-sky-400 text-sky-500" : ""} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Flags</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {GROUP_FLAGS.map((flag) => {
            const Icon = flag.icon
            const active = flags?.[flag.id]
            return (
              <DropdownMenuSub key={flag.id}>
                <DropdownMenuSubTrigger>
                  <Icon className="size-4" />
                  {flag.label}
                  {active && " ✓"}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() =>
                      onSetFlag(
                        flag.id,
                        active === "page" ? "personal" : "page"
                      )
                    }
                  >
                    <Monitor className="size-4" />
                    Page Account {active === "page" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      onSetFlag(
                        flag.id,
                        active === "personal" ? "page" : "personal"
                      )
                    }
                  >
                    <Smartphone className="size-4" />
                    Personal Account {active === "personal" && "✓"}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
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
  flags,
  onSetFlag,
  onRemoveFlag,
  onSelect,
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
  flags: GroupFlagsMap
  onSetFlag: (flagId: GroupFlagId, account: GroupFlagAccount) => void
  onRemoveFlag: (flagId: GroupFlagId) => void
  onSelect?: () => void
}) {
  const [noteOpen, setNoteOpen] = React.useState(false)
  const hasError = status?.status === "error"

  function handleCardClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onSelect) return
    // Don't steal focus/selection from interactive controls inside the card
    const target = e.target as HTMLElement
    if (target.closest("button, textarea, input, label, a, [role='menu'], [role='menuitem'], [role='menuitemradio'], [data-radix-popper-content-wrapper]")) return
    onSelect()
  }

  return (
    <div
      onClick={handleCardClick}
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
            <GroupFlagsBadges flags={flags} onRemove={onRemoveFlag} />
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
        <Textarea
          className="mt-3 min-h-16 text-xs"
          placeholder="Add note..."
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          aria-label={`Note for ${group.name}`}
          rows={3}
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
        <GroupFlagMenuButton flags={flags} onSetFlag={onSetFlag} />
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
  flags,
  onSetFlag,
  onRemoveFlag,
  onSelect,
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
  flags: GroupFlagsMap
  onSetFlag: (flagId: GroupFlagId, account: GroupFlagAccount) => void
  onRemoveFlag: (flagId: GroupFlagId) => void
  onSelect?: () => void
}) {
  function handleCardClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onSelect) return
    const target = e.target as HTMLElement
    if (target.closest("button, textarea, input, label, a, [role='menu'], [role='menuitem'], [role='menuitemradio'], [data-radix-popper-content-wrapper]")) return
    onSelect()
  }
  return (
    <div
      onClick={handleCardClick}
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
          <GroupFlagsBadges flags={flags} onRemove={onRemoveFlag} />
          <StatusIndicator status={status} />
        </div>
        {status?.status === "error" && status.message && (
          <p className="mt-1 truncate text-xs text-destructive" title={status.message}>
            {status.message}
          </p>
        )}
      </div>

      <Textarea
        className="hidden w-40 min-h-16 text-xs lg:block"
        placeholder="Note..."
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        aria-label={`Note for ${group.name}`}
        rows={3}
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

      <GroupFlagMenuButton flags={flags} onSetFlag={onSetFlag} />

      <Button
        variant="ghost"
        size="icon-sm"
        title="Copy direct group URL"
        aria-label={`Copy direct URL for ${group.name}`}
        onClick={() => copyUrl(group)}
        className="shrink-0"
      >
        <Copy />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Open group in new tab"
        aria-label={`Open ${group.name} in a new tab`}
        onClick={() => window.open(group.url, "_blank", "noopener,noreferrer")}
        className="shrink-0"
      >
        <ExternalLink />
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
