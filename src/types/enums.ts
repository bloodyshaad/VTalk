export const POST_TYPES = [
  "image",
  "video",
  "text",
  "poll",
  "album",
] as const;

export const ACCOUNT_TYPES = ["public", "private"] as const;
export const USER_TYPES = ["personal", "professional", "creator"] as const;

export const NOTIFICATION_TYPES = [
  "follow",
  "like",
  "comment",
  "reply",
  "share",
  "mention",
  "message",
  "story",
  "reel",
  "follow_request",
  "accepted",
  "call",
] as const;
