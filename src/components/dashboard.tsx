"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  LayoutGrid,
  List,
  ArrowUpDown,
  EyeOff,
  Eye,
  ChevronDown,
  Search,
  CheckCircle2,
  Circle,
  LogIn,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Header } from "@/components/dashboard/header"
import { StatsBar } from "@/components/dashboard/stats-bar"
import { Composer } from "@/components/dashboard/composer"
import {
  GroupCard,
  GroupListItem,
  GROUP_FLAGS,
  parseMemberCount,
} from "@/components/dashboard/group-card"
import type {
  Group,
  FacebookPage,
  PostStatus,
  GroupDisplayStyle,
  GroupSortOrder,
  GroupFlagId,
  GroupFlagAccount,
  GroupFlagsMap,
} from "@/lib/types"

type GroupFilter = "all" | "posted" | "remaining"

export function Dashboard() {
  const [groups, setGroups] = React.useState<Group[]>([])
  const [manualGroups, setManualGroups] = React.useState<Group[]>([])
  const [addGroupOpen, setAddGroupOpen] = React.useState(false)
  const [addGroupUrl, setAddGroupUrl] = React.useState("")
  const [addGroupName, setAddGroupName] = React.useState("")
  const [addGroupMembers, setAddGroupMembers] = React.useState("")
  const [addGroupPrivacy, setAddGroupPrivacy] = React.useState<"public" | "private" | "unknown">("unknown")
  const [addingGroup, setAddingGroup] = React.useState(false)
  const [pages, setPages] = React.useState<FacebookPage[]>([])
  const [selectedPageId, setSelectedPageId] = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [refreshing, setRefreshing] = React.useState(false)
  const [loginOpen, setLoginOpen] = React.useState(false)
  const [content, setContent] = React.useState("")
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [postStatuses, setPostStatuses] = React.useState<Record<string, PostStatus>>({})
  const [loaded, setLoaded] = React.useState(false)
  const [loggedIn, setLoggedIn] = React.useState<boolean | null>(null)
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null)
  const [loginPending, setLoginPending] = React.useState(false)
  const [pageDetecting, setPageDetecting] = React.useState(false)
  const [displayStyle, setDisplayStyle] = React.useState<GroupDisplayStyle>("grid")
  const [sortOrder, setSortOrder] = React.useState<GroupSortOrder>("default")
  const [filter, setFilter] = React.useState<GroupFilter>("all")
  const [confirmRefreshOpen, setConfirmRefreshOpen] = React.useState(false)
  const [confirmLogoutOpen, setConfirmLogoutOpen] = React.useState(false)
  const [loggingOut, setLoggingOut] = React.useState(false)
  const [postedIds, setPostedIds] = React.useState<Record<string, boolean>>({})
  const [groupNotes, setGroupNotes] = React.useState<Record<string, string>>({})
  const [hiddenIds, setHiddenIds] = React.useState<Record<string, boolean>>({})
  const [groupFlags, setGroupFlags] = React.useState<Record<string, GroupFlagsMap>>({})

  function setNote(groupId: string, note: string) {
    setGroupNotes((prev) => {
      const next = { ...prev, [groupId]: note }
      try {
        window.localStorage.setItem("groupNotes", JSON.stringify(next))
      } catch {
        // localStorage unavailable — note just won't persist
      }
      return next
    })
  }

  function setGroupFlag(
    groupId: string,
    flagId: GroupFlagId,
    account: GroupFlagAccount
  ) {
    setGroupFlags((prev) => {
      const current = prev[groupId] || {}
      const accounts = current[flagId]
      let next: GroupFlagsMap
      if (GROUP_FLAGS.find((f) => f.id === flagId)?.global) {
        // global flags are not account-specific — clicking toggles them on/off
        next = { ...current }
        if (current[flagId]) {
          delete next[flagId]
        } else {
          next[flagId] = "global"
        }
      } else if (Array.isArray(accounts) && accounts.includes(account)) {
        // clicking the active account removes it from the flag
        const remaining = accounts.filter((a) => a !== account)
        next = { ...current }
        if (remaining.length > 0) {
          next[flagId] = remaining
        } else {
          delete next[flagId]
        }
      } else {
        // the same flag can be active for multiple accounts at once
        const list = Array.isArray(accounts) ? accounts : []
        next = { ...current, [flagId]: [...list, account] }
      }
      const updated = { ...prev, [groupId]: next }
      try {
        window.localStorage.setItem("groupFlags", JSON.stringify(updated))
      } catch {
        // localStorage unavailable — flags just won't persist
      }
      return updated
    })
  }

  function removeGroupFlag(groupId: string, flagId: GroupFlagId) {
    setGroupFlags((prev) => {
      const current = prev[groupId]
      if (!current || !(flagId in current)) return prev
      const next: GroupFlagsMap = { ...current }
      delete next[flagId]
      const updated = { ...prev, [groupId]: next }
      try {
        window.localStorage.setItem("groupFlags", JSON.stringify(updated))
      } catch {
        // localStorage unavailable — flags just won't persist
      }
      return updated
    })
  }

  function hideGroup(groupId: string) {
    setHiddenIds((prev) => {
      const next = { ...prev, [groupId]: true }
      try {
        window.localStorage.setItem("hiddenGroupIds", JSON.stringify(next))
      } catch {
        // localStorage unavailable — hide just won't persist
      }
      return next
    })
    if (selectedGroupId === groupId) setSelectedGroupId(null)
    toast.success("Group hidden")
  }

  function unhideGroup(groupId: string) {
    setHiddenIds((prev) => {
      const next = { ...prev, [groupId]: false }
      try {
        window.localStorage.setItem("hiddenGroupIds", JSON.stringify(next))
      } catch {
        // localStorage unavailable — unhide just won't persist
      }
      return next
    })
  }

  function togglePosted(groupId: string) {
    setPostedIds((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] }
      try {
        window.localStorage.setItem("postedGroupIds", JSON.stringify(next))
      } catch {
        // localStorage unavailable — checkbox just won't persist
      }
      return next
    })
  }

  function updateSortOrder(order: GroupSortOrder) {
    setSortOrder(order)
    try {
      window.localStorage.setItem("groupSortOrder", order)
    } catch {
      // localStorage unavailable — order just won't persist
    }
  }

  function updateDisplayStyle(style: GroupDisplayStyle) {
    setDisplayStyle(style)
    try {
      window.localStorage.setItem("groupDisplayStyle", style)
    } catch {
      // localStorage unavailable — style just won't persist
    }
  }

  React.useEffect(() => {
    let cancelled = false
    async function init() {
      const [cacheRes, authRes] = await Promise.all([
        fetch("/api/groups"),
        fetch("/api/auth"),
      ])

      const cache = await cacheRes.json()
      const auth = await authRes.json()

      if (cancelled) return

      setGroups(cache.groups || [])
      setManualGroups(cache.manualGroups || [])
      setPages(cache.pages || [])
      setSelectedPageId(cache.selectedPageId || null)
      setLastUpdated(cache.lastUpdated || null)
      setLoggedIn(auth.loggedIn)

      try {
        const savedStyle = window.localStorage.getItem("groupDisplayStyle")
        if (savedStyle === "grid" || savedStyle === "list") {
          setDisplayStyle(savedStyle)
        }
        const savedOrder = window.localStorage.getItem("groupSortOrder")
        if (
          savedOrder === "default" ||
          savedOrder === "followers-desc" ||
          savedOrder === "followers-asc" ||
          savedOrder === "name-asc"
        ) {
          setSortOrder(savedOrder)
        }
        const savedPosted = window.localStorage.getItem("postedGroupIds")
        if (savedPosted) {
          const parsed = JSON.parse(savedPosted)
          if (parsed && typeof parsed === "object") {
            setPostedIds(parsed as Record<string, boolean>)
          }
        }
        const savedNotes = window.localStorage.getItem("groupNotes")
        if (savedNotes) {
          const parsed = JSON.parse(savedNotes)
          if (parsed && typeof parsed === "object") {
            setGroupNotes(parsed as Record<string, string>)
          }
        }
        const savedHidden = window.localStorage.getItem("hiddenGroupIds")
        if (savedHidden) {
          const parsed = JSON.parse(savedHidden)
          if (parsed && typeof parsed === "object") {
            setHiddenIds(parsed as Record<string, boolean>)
          }
        }
        const savedFlags = window.localStorage.getItem("groupFlags")
        if (savedFlags) {
          const parsed = JSON.parse(savedFlags)
          if (parsed && typeof parsed === "object") {
            // migrate old formats to the multi-account map
            const migrated: Record<string, GroupFlagsMap> = {}
            for (const [gid, value] of Object.entries(parsed)) {
              if (Array.isArray(value)) {
                migrated[gid] = Object.fromEntries(
                  (value as string[]).map((id) => [id, ["personal"]])
                )
              } else if (value && typeof value === "object") {
                const flags: GroupFlagsMap = {}
                for (const [fid, acc] of Object.entries(
                  value as Record<string, unknown>
                )) {
                  if (Array.isArray(acc)) {
                    // global flags used to be stored per-account — migrate to "global"
                    flags[fid as GroupFlagId] = GROUP_FLAGS.find(
                      (f) => f.id === fid
                    )?.global
                      ? "global"
                      : (acc as GroupFlagAccount[])
                  } else if (acc === "page" || acc === "personal") {
                    // old single-account format
                    flags[fid as GroupFlagId] = [acc]
                  }
                }
                migrated[gid] = flags
              }
            }
            setGroupFlags(migrated)
          }
        }
      } catch {
        // localStorage unavailable — keep defaults
      }

      setLoaded(true)
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  async function refreshGroups(backup: boolean) {
    setRefreshing(true)
    setConfirmRefreshOpen(false)
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to refresh groups")
        return
      }

      setGroups(data.groups)
      setManualGroups(data.manualGroups || [])
      setPages(data.pages)
      setLastUpdated(data.lastUpdated)
      toast.success(
        `Loaded ${data.groups.length} groups${backup ? " (old cache backed up)" : ""}`
      )
    } catch {
      toast.error("Failed to refresh groups")
    } finally {
      setRefreshing(false)
    }
  }

  async function addManualGroup() {
    const url = addGroupUrl.trim()
    if (!url) {
      toast.error("Please enter a group URL")
      return
    }
    setAddingGroup(true)
    try {
      const res = await fetch("/api/groups/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          name: addGroupName.trim() || undefined,
          memberCount: addGroupMembers.trim() || undefined,
          privacy: addGroupPrivacy,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to add group")
        return
      }
      setGroups(data.groups || [])
      setManualGroups(data.manualGroups || [])
      setAddGroupOpen(false)
      setAddGroupUrl("")
      setAddGroupName("")
      setAddGroupMembers("")
      setAddGroupPrivacy("unknown")
      toast.success("Group added manually — it will be kept across refreshes")
    } catch {
      toast.error("Failed to add group")
    } finally {
      setAddingGroup(false)
    }
  }

  async function removeManualGroup(groupId: string) {
    try {
      const res = await fetch("/api/groups/manual", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to remove group")
        return
      }
      setManualGroups(data.manualGroups || [])
      if (selectedGroupId === groupId) setSelectedGroupId(null)
      toast.success("Manually added group removed")
    } catch {
      toast.error("Failed to remove group")
    }
  }

  async function logout() {
    setLoggingOut(true)
    setConfirmLogoutOpen(false)
    try {
      const res = await fetch("/api/auth", { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Failed to log out")
        return
      }
      setLoggedIn(false)
      setSelectedPageId(null)
      toast.success("Logged out of Facebook")
    } catch {
      toast.error("Failed to log out")
    } finally {
      setLoggingOut(false)
    }
  }

  async function openLogin() {
    setLoginPending(true)
    setLoginOpen(true)
    try {
      const res = await fetch("/api/auth", { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to open login")
        setLoginOpen(false)
        return
      }

      toast.info(
        "A browser window opened. Please log in to Facebook in it.",
        { duration: 8000 }
      )

      const checkInterval = setInterval(async () => {
        const authRes = await fetch("/api/auth")
        const auth = await authRes.json()
        if (auth.loggedIn) {
          clearInterval(checkInterval)
          setLoggedIn(true)
          setLoginOpen(false)
          toast.success("Logged in to Facebook!")
          setLoginPending(false)
        }
      }, 5000)

      setTimeout(() => {
        clearInterval(checkInterval)
        setLoginPending(false)
      }, 300000)
    } catch {
      toast.error("Failed to open login browser")
      setLoginOpen(false)
      setLoginPending(false)
    }
  }

  async function detectPages() {
    setPageDetecting(true)
    try {
      const res = await fetch("/api/pages", { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to detect pages")
        return
      }

      setPages(data.pages)

      if (data.pages.length === 0) {
        const note = data.diagnostics?.note
        toast.info(
          note
            ? `Page detection failed: ${note}`
            : "No Pages found. You will post as your personal profile.",
          { duration: 8000 }
        )
      } else {
        toast.success(`Found ${data.pages.length} Pages`)
      }
    } catch {
      toast.error("Failed to detect pages")
    } finally {
      setPageDetecting(false)
    }
  }

  async function selectPage(pageId: string | null) {
    setSelectedPageId(pageId)
    try {
      await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", pageId }),
      })
      toast.success(pageId ? "Page selected" : "Posting as personal profile")
    } catch {
      toast.error("Failed to save page preference")
    }
  }

  async function postToGroup(group: Group) {
    const existingStatus = postStatuses[group.id]
    if (existingStatus?.status === "loading") return

    setSelectedGroupId(group.id)
    setPostStatuses((prev) => ({
      ...prev,
      [group.id]: { groupId: group.id, status: "loading" },
    }))

    try {
      const formData = new FormData()
      formData.append("groupUrl", group.url)
      formData.append("text", content)
      if (imageFile) {
        formData.append("image", imageFile)
      }

      const res = await fetch("/api/post", {
        method: "POST",
        body: formData,
      })

      const result = await res.json()

      if (!res.ok) {
        setPostStatuses((prev) => ({
          ...prev,
          [group.id]: {
            groupId: group.id,
            status: "error",
            message: result.error || "Failed to post",
          },
        }))
        toast.error(result.error || "Failed to post")
        return
      }

      if (result.success) {
        setPostStatuses((prev) => ({
          ...prev,
          [group.id]: {
            groupId: group.id,
            status: "success",
            message: result.message,
          },
        }))
        toast.success("Post published to " + group.name)
      } else {
        setPostStatuses((prev) => ({
          ...prev,
          [group.id]: {
            groupId: group.id,
            status: "error",
            message: result.message,
          },
        }))
        toast.error(result.message || "Failed to post")
      }
    } catch {
      setPostStatuses((prev) => ({
        ...prev,
        [group.id]: { groupId: group.id, status: "error", message: "Network error" },
      }))
      toast.error("Network error while posting")
    }
  }

  // Scraped groups + manually added groups (scraped wins on id collision)
  const allGroups = React.useMemo(() => {
    const ids = new Set(groups.map((g) => g.id))
    return [...groups, ...manualGroups.filter((g) => !ids.has(g.id))]
  }, [groups, manualGroups])

  const visibleGroups = allGroups.filter((g) => !hiddenIds[g.id])
  const hiddenGroups = allGroups.filter((g) => hiddenIds[g.id])
  const manualIds = React.useMemo(
    () => new Set(manualGroups.map((g) => g.id)),
    [manualGroups]
  )

  const filteredGroups = sortGroups(
    visibleGroups.filter((g) => {
      const matchesSearch = g.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false
      if (filter === "posted") return !!postedIds[g.id]
      if (filter === "remaining") return !postedIds[g.id]
      return true
    }),
    sortOrder
  )

  const hiddenDisplayGroups = sortGroups(
    hiddenGroups.filter((g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    sortOrder
  )

  const selectedGroup = allGroups.find((g) => g.id === selectedGroupId) || null
  const posting =
    !!selectedGroup && postStatuses[selectedGroup.id]?.status === "loading"
  const postedCount = Object.values(postedIds).filter(Boolean).length
  const totalReach = visibleGroups.reduce(
    (sum, g) => sum + parseMemberCount(g.memberCount),
    0
  )

  const filterOptions: { value: GroupFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "all", label: "All", icon: List },
    { value: "posted", label: "Posted", icon: CheckCircle2 },
    { value: "remaining", label: "Remaining", icon: Circle },
  ]

  return (
    <div className="relative min-h-screen">
      {/* decorative hero background */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-72"
      />

      <Header
        loggedIn={loggedIn}
        loginOpen={loginOpen}
        loginPending={loginPending}
        loggingOut={loggingOut}
        refreshing={refreshing}
        pages={pages}
        selectedPageId={selectedPageId}
        onLogin={openLogin}
        onLogoutRequest={() => setConfirmLogoutOpen(true)}
        onSelectPage={selectPage}
        onDetectPages={detectPages}
        pageDetecting={pageDetecting}
        onRefresh={() => setConfirmRefreshOpen(true)}
        onAddGroup={() => setAddGroupOpen(true)}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
      />

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {!loaded ? (
          <LoadingState />
        ) : (
          <>
            <StatsBar
              loading={false}
              totalGroups={visibleGroups.length}
              postedCount={postedCount}
              errors={0}
              totalMembers={totalReach}
            />

            <Composer
              content={content}
              setContent={setContent}
              imageFile={imageFile}
              setImageFile={setImageFile}
              selectedGroup={selectedGroup}
              posting={posting}
              postStatus={
                selectedGroup ? postStatuses[selectedGroup.id] : undefined
              }
              onPost={() => selectedGroup && postToGroup(selectedGroup)}
              disabled={!loggedIn || (!!selectedGroupId && !selectedGroup)}
              groupId={selectedGroupId}
              onClearSelection={() => setSelectedGroupId(null)}
            />

            <Separator className="my-8" />

            {/* toolbar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative md:hidden">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-40 pl-8"
                  />
                </div>

                <div
                  className="flex items-center rounded-full border bg-card p-0.5"
                  role="group"
                  aria-label="Filter groups"
                >
                  {filterOptions.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                      className={
                        "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors " +
                        (filter === value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      <Icon className="size-3" />
                      {label}
                    </button>
                  ))}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="sm" />}
                  >
                    <ArrowUpDown />
                    Sort
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => updateSortOrder("default")}>
                        Default {sortOrder === "default" && "✓"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateSortOrder("followers-desc")}
                      >
                        Followers (high → low) {sortOrder === "followers-desc" && "✓"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateSortOrder("followers-asc")}
                      >
                        Followers (low → high) {sortOrder === "followers-asc" && "✓"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateSortOrder("name-asc")}>
                        Name (A → Z) {sortOrder === "name-asc" && "✓"}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div
                  className="flex items-center rounded-full border bg-card p-0.5"
                  role="group"
                  aria-label="Group display style"
                >
                  <Button
                    variant={displayStyle === "grid" ? "secondary" : "ghost"}
                    size="icon-sm"
                    className="rounded-full"
                    aria-label="Grid view"
                    aria-pressed={displayStyle === "grid"}
                    onClick={() => updateDisplayStyle("grid")}
                  >
                    <LayoutGrid />
                  </Button>
                  <Button
                    variant={displayStyle === "list" ? "secondary" : "ghost"}
                    size="icon-sm"
                    className="rounded-full"
                    aria-label="List view"
                    aria-pressed={displayStyle === "list"}
                    onClick={() => updateDisplayStyle("list")}
                  >
                    <List />
                  </Button>
                </div>
              </div>

              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  Updated {formatDate(lastUpdated)}
                </span>
              )}
            </div>

            {!loggedIn && (
              <Card className="mb-6 border-dashed shadow-none">
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <LogIn className="size-5" />
                  </div>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Connect your Facebook session to start posting to your
                    groups. A browser window will open for a one-time login.
                  </p>
                  <Button onClick={openLogin} disabled={loginPending} className="shadow-md shadow-primary/20">
                    <LogIn />
                    {loginPending ? "Opening browser..." : "Login with Facebook"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {groups.length === 0 && loggedIn ? (
              <Card className="mb-6 border-dashed shadow-none">
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="max-w-sm text-sm text-muted-foreground">
                    No groups cached yet. Click &quot;Refresh List&quot; to
                    fetch your joined groups.
                  </p>
                  <Button onClick={() => refreshGroups(false)} disabled={refreshing}>
                    <RefreshCw className={refreshing ? "animate-spin" : ""} />
                    Fetch Groups
                  </Button>
                </CardContent>
              </Card>
            ) : displayStyle === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredGroups.map((group, index) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    index={index + 1}
                    posted={!!postedIds[group.id]}
                    onTogglePosted={() => togglePosted(group.id)}
                    status={postStatuses[group.id]}
                    isSelected={selectedGroupId === group.id}
                    disabled={!loggedIn || refreshing}
                    onPost={() => postToGroup(group)}
                    note={groupNotes[group.id] || ""}
                    onNoteChange={(v) => setNote(group.id, v)}
                    hidden={false}
                    onToggleHidden={() => hideGroup(group.id)}
                    flags={groupFlags[group.id] || {}}
                    onSetFlag={(f, a) => setGroupFlag(group.id, f, a)}
                    onRemoveFlag={(f) => removeGroupFlag(group.id, f)}
                              onSelect={() => setSelectedGroupId(group.id)}
                              isManual={manualIds.has(group.id)}
                              onRemove={() => removeManualGroup(group.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredGroups.map((group, index) => (
                  <GroupListItem
                    key={group.id}
                    group={group}
                    index={index + 1}
                    posted={!!postedIds[group.id]}
                    onTogglePosted={() => togglePosted(group.id)}
                    status={postStatuses[group.id]}
                    isSelected={selectedGroupId === group.id}
                    disabled={!loggedIn || refreshing}
                    onPost={() => postToGroup(group)}
                    note={groupNotes[group.id] || ""}
                    onNoteChange={(v) => setNote(group.id, v)}
                    hidden={false}
                    onToggleHidden={() => hideGroup(group.id)}
                    flags={groupFlags[group.id] || {}}
                    onSetFlag={(f, a) => setGroupFlag(group.id, f, a)}
                    onRemoveFlag={(f) => removeGroupFlag(group.id, f)}
                              onSelect={() => setSelectedGroupId(group.id)}
                              isManual={manualIds.has(group.id)}
                              onRemove={() => removeManualGroup(group.id)}
                  />
                ))}
              </div>
            )}

            {filteredGroups.length === 0 && allGroups.length > 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No groups match your search or filter.
              </p>
            )}

            {hiddenGroups.length > 0 && (
              <>
                <Separator className="my-8" />
                <Accordion defaultValue={["hidden"]} keepMounted>
                  <AccordionItem value="hidden">
                    <AccordionTrigger>
                      <span className="flex min-w-0 items-center gap-2">
                        <EyeOff className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-semibold">Hidden groups</span>
                        <Badge variant="secondary">{hiddenGroups.length}</Badge>
                      </span>
                      <ChevronDown className="size-4 shrink-0 transition-transform group-data-panel-open/accordion-item:rotate-180" />
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="mb-2 flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            hiddenGroups.forEach((g) => unhideGroup(g.id))
                          }
                        >
                          <Eye />
                          Unhide all
                        </Button>
                      </div>
                      {hiddenDisplayGroups.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No hidden groups match &quot;{searchQuery}&quot;
                        </p>
                      ) : displayStyle === "grid" ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {hiddenDisplayGroups.map((group, index) => (
                            <GroupCard
                              key={group.id}
                              group={group}
                              index={index + 1}
                              posted={!!postedIds[group.id]}
                              onTogglePosted={() => togglePosted(group.id)}
                              status={postStatuses[group.id]}
                              isSelected={selectedGroupId === group.id}
                              disabled={!loggedIn || refreshing}
                              onPost={() => postToGroup(group)}
                              note={groupNotes[group.id] || ""}
                              onNoteChange={(v) => setNote(group.id, v)}
                              hidden={true}
                              onToggleHidden={() => unhideGroup(group.id)}
                              flags={groupFlags[group.id] || {}}
                              onSetFlag={(f, a) => setGroupFlag(group.id, f, a)}
                              onRemoveFlag={(f) => removeGroupFlag(group.id, f)}
                              onSelect={() => setSelectedGroupId(group.id)}
                              isManual={manualIds.has(group.id)}
                              onRemove={() => removeManualGroup(group.id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {hiddenDisplayGroups.map((group, index) => (
                            <GroupListItem
                              key={group.id}
                              group={group}
                              index={index + 1}
                              posted={!!postedIds[group.id]}
                              onTogglePosted={() => togglePosted(group.id)}
                              status={postStatuses[group.id]}
                              isSelected={selectedGroupId === group.id}
                              disabled={!loggedIn || refreshing}
                              onPost={() => postToGroup(group)}
                              note={groupNotes[group.id] || ""}
                              onNoteChange={(v) => setNote(group.id, v)}
                              hidden={true}
                              onToggleHidden={() => unhideGroup(group.id)}
                              flags={groupFlags[group.id] || {}}
                              onSetFlag={(f, a) => setGroupFlag(group.id, f, a)}
                              onRemoveFlag={(f) => removeGroupFlag(group.id, f)}
                              onSelect={() => setSelectedGroupId(group.id)}
                              isManual={manualIds.has(group.id)}
                              onRemove={() => removeManualGroup(group.id)}
                            />
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}
          </>
        )}
      </main>

      {/* add group manually dialog */}
      <Dialog open={addGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a group manually</DialogTitle>
            <DialogDescription>
              Paste a Facebook group URL (and optionally a name). Manually
              added groups are kept even when you refresh the scraped group
              cache.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="https://www.facebook.com/groups/your-group"
              value={addGroupUrl}
              onChange={(e) => setAddGroupUrl(e.target.value)}
              aria-label="Group URL"
            />
            <Input
              placeholder="Group name (optional)"
              value={addGroupName}
              onChange={(e) => setAddGroupName(e.target.value)}
              aria-label="Group name"
            />
            <div className="flex gap-3">
              <Input
                placeholder="Members (e.g. 12.5K)"
                value={addGroupMembers}
                onChange={(e) => setAddGroupMembers(e.target.value)}
                aria-label="Member count"
                className="flex-1"
              />
              <select
                value={addGroupPrivacy}
                onChange={(e) =>
                  setAddGroupPrivacy(
                    e.target.value as "public" | "private" | "unknown"
                  )
                }
                aria-label="Privacy"
                className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="unknown">Privacy: unknown</option>
                <option value="public">Privacy: public</option>
                <option value="private">Privacy: private</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddGroupOpen(false)}
              disabled={addingGroup}
            >
              Cancel
            </Button>
            <Button onClick={addManualGroup} disabled={addingGroup}>
              {addingGroup ? "Adding..." : "Add group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* confirm refresh dialog */}
      <Dialog open={confirmRefreshOpen} onOpenChange={setConfirmRefreshOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refresh group list?</DialogTitle>
            <DialogDescription>
              This re-scrapes your groups with the browser. It can take a
              while, and Facebook may temporarily restrict heavy scraping.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRefreshOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => refreshGroups(true)} disabled={refreshing}>
              Refresh with backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* confirm logout dialog */}
      <Dialog open={confirmLogoutOpen} onOpenChange={setConfirmLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out of Facebook?</DialogTitle>
            <DialogDescription>
              Your saved session will be cleared. You will need to log in
              again to post.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLogoutOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={logout} disabled={loggingOut}>
              {loggingOut ? "Logging out..." : "Log out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function sortGroups(groups: Group[], order: GroupSortOrder): Group[] {
  const sorted = [...groups]
  switch (order) {
    case "followers-desc":
      return sorted.sort(
        (a, b) => parseMemberCount(b.memberCount) - parseMemberCount(a.memberCount)
      )
    case "followers-asc":
      return sorted.sort(
        (a, b) => parseMemberCount(a.memberCount) - parseMemberCount(b.memberCount)
      )
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    default:
      return sorted
  }
}
