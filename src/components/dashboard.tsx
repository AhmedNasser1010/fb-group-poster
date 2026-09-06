"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Globe,
  Lock,
  RefreshCw,
  Send,
  Search,
  LogIn,
  LayoutGrid,
  List,
  ArrowUpDown,
  LogOut,
  Copy,
  ExternalLink,
  EyeOff,
  Eye,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
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
import { ThemeToggle } from "@/components/theme-toggle"
import type {
  Group,
  FacebookPage,
  PostStatus,
  GroupDisplayStyle,
  GroupSortOrder,
} from "@/lib/types"

export function Dashboard() {
  const [groups, setGroups] = React.useState<Group[]>([])
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
  const [confirmRefreshOpen, setConfirmRefreshOpen] = React.useState(false)
  const [confirmLogoutOpen, setConfirmLogoutOpen] = React.useState(false)
  const [loggingOut, setLoggingOut] = React.useState(false)
  const [postedIds, setPostedIds] = React.useState<Record<string, boolean>>({})
  const [groupNotes, setGroupNotes] = React.useState<Record<string, string>>({})
  const [hiddenIds, setHiddenIds] = React.useState<Record<string, boolean>>({})

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
      // localStorage unavailable (e.g. private mode) — order just won't persist
    }
  }

  function updateDisplayStyle(style: GroupDisplayStyle) {
    setDisplayStyle(style)
    try {
      window.localStorage.setItem("groupDisplayStyle", style)
    } catch {
      // localStorage unavailable (e.g. private mode) — style just won't persist
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
      } catch {
        // localStorage unavailable — keep default grid style
      }

      if (cache.selectedPageId && cache.pages?.length === 0) {
        detectPages()
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

  const filteredGroups = sortGroups(
    groups.filter(
      (g) =>
        !hiddenIds[g.id] &&
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    sortOrder
  )

  const hiddenGroups = groups.filter((g) => hiddenIds[g.id])

  const hiddenDisplayGroups = sortGroups(
    hiddenGroups.filter((g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    sortOrder
  )

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null

  const posting =
    !!selectedGroup && postStatuses[selectedGroup.id]?.status === "loading"

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Facebook Group Poster</h1>
            {loggedIn && (
              <Badge variant="outline" className="text-emerald-600">
                Logged in
              </Badge>
            )}
            {loggedIn === false && (
              <Badge variant="destructive">Not logged in</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!loggedIn && !loginOpen && (
              <Button
                size="sm"
                variant="outline"
                disabled={loginPending}
                onClick={openLogin}
              >
                <LogIn />
                {loginPending ? "Opening..." : "Login to Facebook"}
              </Button>
            )}
            {loggedIn && (
              <Button
                size="sm"
                variant="outline"
                disabled={loggingOut}
                onClick={() => setConfirmLogoutOpen(true)}
              >
                <LogOut />
                {loggingOut ? "Logging out..." : "Logout"}
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!loaded ? (
          <LoadingState />
        ) : (
          <>
            <PostPanel
              content={content}
              setContent={setContent}
              imageFile={imageFile}
              setImageFile={setImageFile}
              selectedGroup={selectedGroup}
              posting={posting}
              postStatus={
                selectedGroup
                  ? postStatuses[selectedGroup.id]
                  : undefined
              }
              onPost={() => selectedGroup && postToGroup(selectedGroup)}
              disabled={!loggedIn || (!!selectedGroupId && !selectedGroup)}
              groupId={selectedGroupId}
              onClearSelection={() => setSelectedGroupId(null)}
            />

            <Separator className="my-8" />

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setConfirmRefreshOpen(true)}
                  disabled={refreshing || !loggedIn}
                >
                  <RefreshCw className={refreshing ? "animate-spin" : ""} />
                  Refresh List
                </Button>

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
                      <DropdownMenuItem
                        onClick={() => updateSortOrder("default")}
                      >
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
                  className="flex items-center rounded-lg border"
                  role="group"
                  aria-label="Group display style"
                >
                  <Button
                    variant={displayStyle === "grid" ? "secondary" : "ghost"}
                    size="icon-sm"
                    aria-label="Grid view"
                    aria-pressed={displayStyle === "grid"}
                    onClick={() => updateDisplayStyle("grid")}
                  >
                    <LayoutGrid />
                  </Button>
                  <Button
                    variant={displayStyle === "list" ? "secondary" : "ghost"}
                    size="icon-sm"
                    aria-label="List view"
                    aria-pressed={displayStyle === "list"}
                    onClick={() => updateDisplayStyle("list")}
                  >
                    <List />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <PageSelector
                  pages={pages}
                  selectedPageId={selectedPageId}
                  onSelect={selectPage}
                  onDetect={detectPages}
                  detecting={pageDetecting}
                  disabled={!loggedIn}
                />
                {lastUpdated && (
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDate(lastUpdated)}
                  </span>
                )}
              </div>
            </div>

            {pages.length > 0 && (
              <div className="mb-4">
                <Badge variant="secondary" className="gap-1.5">
                  {selectedPageId
                    ? `Posting as: ${pages.find((p) => p.id === selectedPageId)?.name}`
                    : "Posting as: Personal Profile"}
                </Badge>
              </div>
            )}

            {!loggedIn && (
              <Card className="mb-6 border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="text-muted-foreground">
                    You need to log in to Facebook to use this app.
                  </p>
                  <Button onClick={openLogin} disabled={loginPending}>
                    <LogIn />
                    {loginPending ? "Opening browser..." : "Login with Facebook"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {groups.length === 0 && loggedIn ? (
              <Card className="mb-6 border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="text-muted-foreground">
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
                  />
                ))}
              </div>
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
                            />
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}

            {filteredGroups.length === 0 && groups.length > 0 && (
              <p className="py-8 text-center text-muted-foreground">
                No groups match &quot;{searchQuery}&quot;
              </p>
            )}

            <Dialog open={confirmRefreshOpen} onOpenChange={setConfirmRefreshOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Refresh groups list?</DialogTitle>
                  <DialogDescription>
                    This re-scrapes your joined Facebook groups and overwrites
                    the cached groups.json. You can keep a copy of the current
                    cache before it is replaced.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmRefreshOpen(false)}
                    disabled={refreshing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => refreshGroups(true)}
                    disabled={refreshing}
                  >
                    Keep Backup & Refresh
                  </Button>
                  <Button
                    onClick={() => refreshGroups(false)}
                    disabled={refreshing}
                  >
                    {refreshing && <RefreshCw className="animate-spin" />}
                    Replace Cache
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={confirmLogoutOpen} onOpenChange={setConfirmLogoutOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log out of Facebook?</DialogTitle>
                  <DialogDescription>
                    This clears the saved Facebook session and closes the
                    browser. You will need to log in again to post to groups.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmLogoutOpen(false)}
                    disabled={loggingOut}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={logout}
                    disabled={loggingOut}
                  >
                    {loggingOut && <RefreshCw className="animate-spin" />}
                    Log out
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </>
        )}
      </main>
    </div>
  )
}

function PageSelector({
  pages,
  selectedPageId,
  onSelect,
  onDetect,
  detecting,
  disabled,
}: {
  pages: FacebookPage[]
  selectedPageId: string | null
  onSelect: (pageId: string | null) => void
  onDetect: () => void
  detecting: boolean
  disabled: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <Button variant="outline" size="sm" disabled={disabled || detecting} />
        )}
      >
        <Avatar className="size-5">
          <AvatarImage
            src={pages.find((p) => p.id === selectedPageId)?.avatarUrl}
          />
          <AvatarFallback className="text-[10px]">
            {(pages.find((p) => p.id === selectedPageId)?.name || "P")
              .charAt(0)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {selectedPageId
          ? pages.find((p) => p.id === selectedPageId)?.name
          : "Post as..."}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Post as</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuItem onClick={() => onSelect(null)}>
          <span>Personal Profile</span>
        </DropdownMenuItem>
        {pages.map((page) => (
          <DropdownMenuItem
            key={page.id}
            onClick={() => onSelect(page.id)}
          >
            <Avatar className="mr-2 size-6">
              <AvatarImage src={page.avatarUrl} />
              <AvatarFallback className="text-[10px]">
                {page.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {page.name}
          </DropdownMenuItem>
        ))}
        {pages.length === 0 && (
          <DropdownMenuItem disabled>
            <span>No Pages detected</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDetect}>
          <RefreshCw className={detecting ? "animate-spin" : ""} />
          Detect Page...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GroupCard({
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
    <Card
      className={
        "transition-colors " +
        (isSelected ? "border-primary/60 ring-1 ring-primary/30" : "") +
        (posted ? " border-emerald-600/40" : "")
      }
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarImage src={group.logoUrl} />
            <AvatarFallback>
              {group.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={group.name}>
              <span className="mr-1.5 text-muted-foreground">#{index}</span>
              {group.name}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              {group.privacy === "public" ? (
                <Badge variant="outline" className="gap-1 text-emerald-600">
                  <Globe className="size-3" />
                  Public
                </Badge>
              ) : group.privacy === "private" ? (
                <Badge variant="outline" className="gap-1 text-amber-600">
                  <Lock className="size-3" />
                  Private
                </Badge>
              ) : (
                <Badge variant="outline">Unknown privacy</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {group.memberCount} members
              </span>
            </div>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={posted}
              onChange={onTogglePosted}
              className="size-4 cursor-pointer accent-emerald-600"
              aria-label={`Mark ${group.name} as posted`}
            />
            <span className="text-xs text-muted-foreground">Posted</span>
          </label>
        </div>

        {status && status.status !== "idle" && (
          <div className="mt-3">
            {status.status === "loading" && (
              <Badge variant="secondary">
                <RefreshCw className="animate-spin" />
                Posting...
              </Badge>
            )}
            {status.status === "success" && (
              <Badge className="bg-emerald-600 text-white">Posted</Badge>
            )}
            {status.status === "error" && (
              <>
                <Badge variant="destructive">Failed</Badge>
                {status.message && (
                  <p className="mt-1 text-xs text-destructive">
                    {status.message}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            className="w-full"
            size="sm"
            onClick={onPost}
            disabled={
              disabled || status?.status === "loading"
            }
          >
            {status?.status === "loading" ? (
              <RefreshCw className="animate-spin" />
            ) : (
              <Send />
            )}
            Post
          </Button>
          <Button
            variant="outline"
            size="sm"
            title="Copy direct group URL"
            aria-label={`Copy direct URL for ${group.name}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(group.url)
                toast.success("Group URL copied")
              } catch {
                toast.error("Failed to copy URL")
              }
            }}
          >
            <Copy />
            Copy URL
          </Button>
          <Button
            variant="outline"
            size="sm"
            title="Open group in new tab"
            aria-label={`Open ${group.name} in a new tab`}
            onClick={() => window.open(group.url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink />
            Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            title={hidden ? "Unhide group" : "Hide group"}
            aria-label={hidden ? `Unhide ${group.name}` : `Hide ${group.name}`}
            onClick={onToggleHidden}
          >
            {hidden ? <Eye /> : <EyeOff />}
            {hidden ? "Unhide" : "Hide"}
          </Button>
        </div>

        <Input
          className="mt-2 h-8 text-xs"
          placeholder="Add note..."
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          aria-label={`Note for ${group.name}`}
        />
      </CardContent>
    </Card>
  )
}

function GroupListItem({
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
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors " +
        (isSelected ? "border-primary/60 ring-1 ring-primary/30" : "") +
        (posted ? " border-emerald-600/40" : "")
      }
    >
      <span className="shrink-0 text-sm text-muted-foreground" title={`Group #${index}`}>
        #{index}
      </span>
      <Avatar className="size-9">
        <AvatarImage src={group.logoUrl} />
        <AvatarFallback className="text-sm">
          {group.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={group.name}>
          {group.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {group.privacy === "public" ? (
            <Badge variant="outline" className="gap-1 text-emerald-600">
              <Globe className="size-3" />
              Public
            </Badge>
          ) : group.privacy === "private" ? (
            <Badge variant="outline" className="gap-1 text-amber-600">
              <Lock className="size-3" />
              Private
            </Badge>
          ) : (
            <Badge variant="outline">Unknown privacy</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {group.memberCount} members
          </span>
          {status?.status === "success" && (
            <Badge className="bg-emerald-600 text-white">Posted</Badge>
          )}
          {status?.status === "error" && (
            <Badge variant="destructive">Failed</Badge>
          )}
          {status?.status === "loading" && (
            <Badge variant="secondary">
              <RefreshCw className="animate-spin" />
              Posting...
            </Badge>
          )}
        </div>
        {status?.status === "error" && status.message && (
          <p className="mt-1 truncate text-xs text-destructive" title={status.message}>
            {status.message}
          </p>
        )}
        <Input
          className="mt-1.5 h-7 text-xs"
          placeholder="Add note..."
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          aria-label={`Note for ${group.name}`}
        />
      </div>

      <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={posted}
          onChange={onTogglePosted}
          className="size-4 cursor-pointer accent-emerald-600"
          aria-label={`Mark ${group.name} as posted`}
        />
        <span className="text-xs text-muted-foreground">Posted</span>
      </label>

      <Button
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
        variant="outline"
        size="icon-sm"
        title={hidden ? "Unhide group" : "Hide group"}
        aria-label={hidden ? `Unhide ${group.name}` : `Hide ${group.name}`}
        onClick={onToggleHidden}
      >
        {hidden ? <Eye /> : <EyeOff />}
      </Button>
    </div>
  )
}

function PostPanel({
  content,
  setContent,
  imageFile,
  setImageFile,
  selectedGroup,
  posting,
  postStatus,
  onPost,
  disabled,
  groupId,
  onClearSelection,
}: {
  content: string
  setContent: (v: string) => void
  imageFile: File | null
  setImageFile: (f: File | null) => void
  selectedGroup: Group | null
  posting: boolean
  postStatus?: PostStatus
  onPost: () => void
  disabled: boolean
  groupId: string | null
  onClearSelection: () => void
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  return (
    <Card id="post-panel">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Compose Post</h2>
          {groupId && !selectedGroup && (
            <Badge variant="destructive">Group not found</Badge>
          )}
          {selectedGroup && (
            <Badge variant="secondary">{selectedGroup.name}</Badge>
          )}
        </div>

        {groupId && selectedGroup && (
          <Button
            variant="ghost"
            size="xs"
            className="mb-2"
            onClick={onClearSelection}
          >
            Clear selection
          </Button>
        )}

        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {groupId
              ? "Posting to: " +
                (selectedGroup?.name || "Unknown group")
              : "Select a group by clicking Post on its card"}
          </p>
          {postStatus?.status === "loading" && (
            <Badge variant="secondary">
              <RefreshCw className="animate-spin" />
              Posting...
            </Badge>
          )}
        </div>

        <Textarea
          placeholder="Write your post content here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[120px]"
          disabled={disabled}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] || null
            setImageFile(f)
          }}
        />

        <div className="mt-3 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            {imageFile ? "Change Image" : "Attach Image"}
          </Button>
          {imageFile && (
            <>
              <span className="text-xs text-muted-foreground">
                {imageFile.name}
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setImageFile(null)}
                disabled={disabled}
              >
                Remove
              </Button>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button
            onClick={onPost}
            disabled={disabled || !content.trim() || posting}
          >
            {posting && <RefreshCw className="animate-spin" />}
            <Send className={posting ? "" : ""} />
            Post to{groupId ? " Group" : "..."}
          </Button>

          {postStatus?.status === "error" && postStatus.message && (
            <p className="text-sm text-destructive">
              {postStatus.message}
            </p>
          )}
          {postStatus?.status === "success" && (
            <p className="text-sm text-emerald-600">
              {postStatus.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-40 ml-auto" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="mt-4 h-8 w-full" />
            </CardContent>
          </Card>
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

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"