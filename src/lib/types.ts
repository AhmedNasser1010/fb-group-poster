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
