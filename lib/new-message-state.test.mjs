import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { NEW_MESSAGE_STORAGE_KEY, loadNewMessageSessionIds, saveNewMessageSessionIds } = await jiti.import("./new-message-state.ts");

function withWindow(storage, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  try { run(); } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  }
}

test("background completion reminders persist and ignore malformed ids", () => {
  const values = new Map([[NEW_MESSAGE_STORAGE_KEY, JSON.stringify(["session-1", 4, "", "session-2"])]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  withWindow(storage, () => {
    const ids = loadNewMessageSessionIds();
    assert.deepEqual([...ids], ["session-1", "session-2"]);
    ids.delete("session-1");
    saveNewMessageSessionIds(ids);
    assert.deepEqual(JSON.parse(values.get(NEW_MESSAGE_STORAGE_KEY)), ["session-2"]);
  });
});
