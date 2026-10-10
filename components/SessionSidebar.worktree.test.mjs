import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");

test("uses the server-resolved current worktree identity", () => {
  assert.match(source, /currentWorktreePath: string \| null/);
  assert.match(
    source,
    /const currentWorktree =[\s\S]*?worktreeState\.currentWorktreePath[\s\S]*?worktree\.path === worktreeState\.currentWorktreePath/,
  );
  assert.match(source, /if \(currentWorktreePath === path\) setSelectedCwd\(project\.root\);/);
  assert.doesNotMatch(source, /const isCurrent = wt\.path === selectedCwd/);
});

test("does not let a stale subdirectory worktree list mask an exact project", () => {
  const start = source.indexOf("const projectFor = useCallback");
  const end = source.indexOf("// A worktree/session refresh", start);
  const projectFor = source.slice(start, end);
  assert.match(projectFor, /const match = allSessions\.find/);
  assert.match(projectFor, /if \(match\) \{[\s\S]*?projectSelection\(match\.projectRoot/);
  assert.match(projectFor, /worktreeState\?\.isTopLevel && worktreeState\.worktrees\.some/);
});
