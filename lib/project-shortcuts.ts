export const PROJECT_SHORTCUTS_STORAGE_KEY = "pi-web:project-shortcuts";
export const PROJECT_SHORTCUT_INITIAL_COUNT = 5;
export const PROJECT_SHORTCUT_MAX_COUNT = 20;

export type ProjectShortcut = { projectKey: string | null; name?: string };

export function shortcutName(value: string): string {
  const han = value.match(/[\p{Script=Han}]/gu);
  if (han?.length) return han.join("").slice(0, 3);
  return (value.match(/[a-z]/gi)?.join("") ?? "").slice(0, 4);
}

export function emptyProjectShortcuts(count = PROJECT_SHORTCUT_INITIAL_COUNT): ProjectShortcut[] {
  return Array.from({ length: Math.min(Math.max(0, count), PROJECT_SHORTCUT_MAX_COUNT) }, () => ({ projectKey: null }));
}

export function normalizeProjectShortcuts(value: unknown): ProjectShortcut[] | null {
  if (!Array.isArray(value)) return null;
  return value.slice(0, PROJECT_SHORTCUT_MAX_COUNT).map((slot) => {
    if (!slot || typeof slot !== "object") return { projectKey: null };
    const item = slot as { projectKey?: unknown; name?: unknown };
    const name = typeof item.name === "string" ? shortcutName(item.name) : "";
    return {
      projectKey: typeof item.projectKey === "string" && item.projectKey ? item.projectKey : null,
      ...(name ? { name } : {}),
    };
  });
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

export function loadProjectShortcuts(storage: StorageLike | null = browserStorage()): ProjectShortcut[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PROJECT_SHORTCUTS_STORAGE_KEY);
    return raw === null ? null : normalizeProjectShortcuts(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveProjectShortcuts(slots: ProjectShortcut[], storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(PROJECT_SHORTCUTS_STORAGE_KEY, JSON.stringify(slots.slice(0, PROJECT_SHORTCUT_MAX_COUNT)));
  } catch {
    // Persistence is best-effort; a storage quota must not break the sidebar.
  }
}
