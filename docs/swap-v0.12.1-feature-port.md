# pi-swap-web old-final feature port checklist

Baseline: upstream pi-web v0.12.2 (`b017cd4`). Source of local behavior: frozen old-final tag `pi-swap-web-old-final-20261017`.

Rule: preserve upstream v0.12.2 behavior and tests. Port local behavior as additive/adapted changes; do not replace upstream components wholesale. Keep this checklist updated with implementation and test status.

## 1. Branding and launcher
- [x] Package name `pi-swap-web`; command/bin `pi-swap-web`; keep upstream release version (`0.12.2`).
- [x] App/PWA metadata defaults to `pi-swap-web`; preserve `PI_WEB_APP_NAME` override.
- [x] Add launcher based on upstream `bin/pi-web.js`, retaining Node-version checks, options, lifecycle and host/password warnings.
- [x] README documents local fork, shared `~/.pi/agent`, run flow, and upstream tracking.

## 2. Workspace, project shortcuts, and worktrees
- [x] v0.12.2 already has workspace memory, worktree management, draft parking, and stale restore guards. Ported two old-final fixes for stale project identity during workspace switches.
- [x] Added project shortcuts: default 5, adjustable to 20, add/remove/rename, wrap rather than horizontal-scroll, same local-storage key as old-final.
- [x] Selecting a project scopes the conversation tree and archive to that project (including its worktrees), matching old-final instead of showing every project's groups together.
- [x] Moved “Open another project” from the list footer to an icon-only button beside New in the top sidebar row.
- [x] v0.12.2 already includes project activity badges in project/worktree selection.
- [x] Added focused tests for stale project/worktree identity and shortcut normalization/cap.

## 3. Session sidebar reminders and archive actions
- [x] v0.12.2 already includes unread/running/archive state, delete confirmation, and archive bulk actions.
- [x] Added a distinct, persistent background-completion reminder; subtle green row cue; clears when the user scrolls to the session tail; no in-chat banner.
- [ ] Regression tests for reminder transitions and destructive confirmation.

## 4. Provider usage display
- [x] Added top-bar usage status with last-success cache, five-minute refresh and manual refresh; reuses server-side provider credentials. Positioned directly after Tools, before session statistics.
- [x] Shows Codex quota windows and provider daily usage/balance where supported.
- [x] DeepSeek aliases map to official account; prefer CNY; daily spend estimated from topped-up balance changes with hashed account key, lock, atomic replace, and 40-day retention.
- [x] Added local-session daily usage endpoint using local calendar-day boundaries and excluding subagents.
- [ ] Add deeper tests for daily-boundary, concurrent writes, and top-up/refund handling.

## 5. Chat and visual preferences
- [x] Preserve v0.12.2 paging, turn numbering, minimap lock, cache/cost notices, duration, upload/drop, and streaming code.
- [x] Restored old-final 22px chat-content default, Chinese-friendly UI font stack, 12px scrollbars.
- [x] Minimap click/outside-click preview behavior added while retaining upstream lock control and paged-history/turn-number features.
- [ ] Add minimap interaction regression test.

## 6. Developer/demo and operational behavior
- [x] Hide Next dev indicator; demo dev server listens on `0.0.0.0:30142` as in old-final.
- [x] Added an isolated-worktree updater that skips tags, requires clean source, backs up before rebase, preserves package identity/version, and checks `BUILD_ID`.
- [x] Verify updater shell syntax (`bash -n`) and package/bin/version identity in this worktree.
- [ ] Production promotion remains separate: stop guard first; never touch the old-final tree during development.

## Validation record
- `tsc --noEmit`: passed after the initial feature port.
- Focused tests (usage, DeepSeek history, shortcuts, reminder storage, project/worktree identity): 9 passed.
- Full `npm test`: passed; 2,787 passed, 1 skipped, 0 failed (2,788 total).
- `npm run build`: passed; generated `.next/BUILD_ID`. Next emitted the existing dynamic-dependency warning from `app/api/sessions/[id]/export/route.ts`.
- `bash -n scripts/update-upstream.sh` and package identity checks: passed (`pi-swap-web` 0.12.2, bin `bin/pi-swap-web.js`).
- Preview correction cycle: project-scoping and usage tests passed; full `npm test` passed (2,790 passed, 1 skipped, 0 failed); `npx tsc --noEmit` and `npm run build` passed.
- Preview `pi-swap-web-preview.service` on 30142 now inherits the production HTTP/HTTPS proxy (`http://192.168.0.42:7890`); an unauthenticated DeepSeek endpoint probe through that proxy reached the service (HTTP 401, expected without API auth).
- Production `.next` and service have not been modified by this work; only this isolated worktree was built.
