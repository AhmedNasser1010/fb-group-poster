"use client"

import * as React from "react"
import { ImageIcon, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { Group, PostStatus } from "@/lib/types"

export function Composer({
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

  const previewUrl = React.useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile]
  )

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const canPost = !disabled && !!content.trim() && !posting

  return (
    <section
      id="post-panel"
      className="relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow focus-within:shadow-lg focus-within:shadow-primary/5"
    >
      {/* gradient accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Send className="size-3.5" />
            </span>
            Compose Post
          </h2>
          {groupId && !selectedGroup && (
            <Badge variant="destructive">Group not found</Badge>
          )}
          {selectedGroup && (
            <Badge variant="secondary" className="max-w-56">
              <span className="truncate">{selectedGroup.name}</span>
              <button
                onClick={onClearSelection}
                aria-label="Clear group selection"
                className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
        </div>

        {groupId && !selectedGroup && (
          <p className="mb-3 text-sm text-destructive">
            The selected group could not be found. Pick another group below.
          </p>
        )}
        {!groupId && (
          <p className="mb-3 text-sm text-muted-foreground">
            Select a group by clicking <strong>Post</strong> on its card, then
            publish your content here.
          </p>
        )}

        <Textarea
          placeholder="Write your post content here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-32 resize-y border-none bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
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

        {previewUrl && (
          <div className="relative mt-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Attached image preview"
              className="max-h-40 rounded-lg border object-cover"
            />
            <Button
              size="icon-sm"
              variant="secondary"
              className="absolute -right-2 -top-2 rounded-full shadow-md"
              aria-label="Remove attached image"
              onClick={() => setImageFile(null)}
              disabled={disabled}
            >
              <X />
            </Button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <ImageIcon />
              {imageFile ? "Replace image" : "Add image"}
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {content.length} chars
            </span>
          </div>

          <div className="flex items-center gap-3">
            {postStatus?.status === "error" && postStatus.message && (
              <p className="max-w-56 truncate text-xs text-destructive" title={postStatus.message}>
                {postStatus.message}
              </p>
            )}
            {postStatus?.status === "success" && (
              <p className="max-w-56 truncate text-xs text-emerald-600" title={postStatus.message}>
                {postStatus.message}
              </p>
            )}
            <Button
              onClick={onPost}
              disabled={!canPost}
              className="shadow-md shadow-primary/20 transition-transform active:scale-[0.98]"
            >
              {posting ? <Send className="animate-pulse" /> : <Send />}
              {posting
                ? "Posting…"
                : groupId
                  ? "Post to Group"
                  : "Select a group to post"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
