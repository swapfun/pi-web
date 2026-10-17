import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");

test("the conversation pane is project-scoped and the open-project action lives in the header", () => {
  assert.match(source, /sessionsForProject\(allSessions, selectedProject\.key\)/);
  assert.match(source, /conversationModel\.rows\.filter\(\(row\) => row\.kind !== "footer-open"\)/);
  assert.match(source, /className="sidebar-open-project-button"[\s\S]*?FolderPlusIcon/);
  assert.match(source, /rows=\{conversationRows\}/);
});

test("exact session identity takes precedence over a stale subdirectory worktree response", () => {
  const start = source.indexOf("const projectFor = useCallback");
  const end = source.indexOf("// The project of the sidebar's cwd", start);
  const body = source.slice(start, end);
  assert.match(body, /const match = allSessions\.find/);
  assert.match(body, /if \(match\) return projectSelection\(match\.projectRoot/);
  assert.match(body, /worktreeState\?\.isTopLevel && worktreeState\.worktrees\.some/);
});
