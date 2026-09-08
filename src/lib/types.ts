export interface FacebookPage {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface Group {
  id: string;
  name: string;
  privacy: "public" | "private" | "unknown";
  memberCount: string;
  logoUrl: string;
  url: string;
}

export type GroupFlagId =
  | "no-reshare"
  | "accept-posts"
  | "long-pending"
  | "auto-reject"
  | "posts-deleted"
  | "check-again"
  | "posting-disabled"

export type GroupFlagAccount = "page" | "personal"

// Map of groupId -> active flags. Account-specific flags map to the list of
// accounts they apply to; global flags (meta.global) map to "global" and apply
// to the group regardless of which account is used
export type GroupFlagsMap = Partial<Record<GroupFlagId, GroupFlagAccount[] | "global">>

export type GroupDisplayStyle = "grid" | "list";

export type GroupSortOrder =
  | "default"
  | "followers-desc"
  | "followers-asc"
  | "name-asc";

export interface CacheData {
  groups: Group[];
  pages: FacebookPage[];
  lastUpdated: string | null;
  selectedPageId: string | null;
}

export interface PostStatus {
  groupId: string;
  status: "idle" | "loading" | "success" | "error";
  message?: string;
}

export const EMPTY_CACHE: CacheData = {
  groups: [],
  pages: [],
  lastUpdated: null,
  selectedPageId: null,
};
