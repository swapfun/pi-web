import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { PROJECT_SHORTCUT_MAX_COUNT, normalizeProjectShortcuts, shortcutName } = await jiti.import("./project-shortcuts.ts");

test("project shortcuts normalize labels and cap at twenty", () => {
  const input = Array.from({ length: 25 }, (_, index) => ({ projectKey: `/project/${index}`, name: "工作项目" }));
  const normalized = normalizeProjectShortcuts(input);
  assert.equal(normalized?.length, PROJECT_SHORTCUT_MAX_COUNT);
  assert.equal(normalized?.[0].name, "工作项");
});

test("invalid shortcut storage is ignored and English labels stay short", () => {
  assert.equal(normalizeProjectShortcuts({ bad: true }), null);
  assert.equal(shortcutName("pi-swap web"), "pisw");
  assert.deepEqual(normalizeProjectShortcuts([null, { projectKey: "", name: "!!!" }]), [
    { projectKey: null },
    { projectKey: null },
  ]);
});
