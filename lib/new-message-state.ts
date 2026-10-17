export const NEW_MESSAGE_STORAGE_KEY = "pi-web:new-message-session-ids";
export const NEW_MESSAGE_READ_EVENT = "pi-web:new-message-read";

export function loadNewMessageSessionIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(NEW_MESSAGE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

export function saveNewMessageSessionIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NEW_MESSAGE_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Browser storage is best-effort.
  }
}
