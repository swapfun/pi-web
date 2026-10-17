import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");

test("provider balance status is rendered immediately beside the Tools toolbar", () => {
  const tools = source.indexOf("{renderChatToolbarActions(false)}");
  const usage = source.indexOf("<TopUsageStatus model={usageModel}");
  const stats = source.indexOf("{renderSessionStatsButton(false)}", usage);
  assert.ok(tools >= 0 && usage > tools && stats > usage);
});

test("the mounted session identity wins over a stale target-project ref", () => {
  assert.match(source, /const currentProject = selectedSession\s*\? workspaceKeyOf\(selectedSession\)\s*: activeProjectKeyRef\.current \?\? null/);
});
