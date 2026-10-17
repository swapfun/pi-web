#!/usr/bin/env bash
# Rebase the isolated development branch on upstream and build it in-place.
# Never run this against the active production worktree/service.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
PRODUCTION_DIR="/home/swap/pi-swap-web"
if [[ "$ROOT_DIR" == "$PRODUCTION_DIR" ]]; then
  echo "Refusing to update the active production worktree. Use a separate worktree and the guarded deployment procedure." >&2
  exit 1
fi

branch="$(git branch --show-current)"
if [[ "$branch" != pi-swap-web* ]]; then
  echo "Expected a pi-swap-web development branch; found: ${branch:-detached HEAD}" >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Worktree is not clean; commit or save changes first:" >&2
  git status --short >&2
  exit 1
fi

git remote get-url upstream >/dev/null 2>&1 || {
  echo "Missing upstream remote (https://github.com/agegr/pi-web.git)." >&2
  exit 1
}

echo "Fetching upstream main (without historical tags)..."
git fetch upstream main
upstream_head="$(git rev-parse upstream/main)"
base="$(git merge-base HEAD upstream/main)"
if [[ "$base" == "$upstream_head" ]]; then
  echo "Already based on upstream/main; no rebase or rebuild needed."
  exit 0
fi

before="$(git rev-parse HEAD)"
backup_tag="backup-before-upstream-$(date +%Y%m%d-%H%M%S)"
while git rev-parse --verify --quiet "refs/tags/$backup_tag" >/dev/null; do backup_tag="${backup_tag}-1"; done
git tag "$backup_tag" "$before"
echo "Rollback tag created: $backup_tag"

echo "Rebasing local changes onto upstream/main..."
if ! git rebase upstream/main; then
  cat >&2 <<'EOF'
Rebase stopped at conflicts. Preserve pi-swap-web branding and local features while taking upstream behavior; do not choose one side wholesale.
Resolve conflicts, run `git rebase --continue`, then rerun this script.
Abort with `git rebase --abort` if the merge is unsafe.
EOF
  exit 1
fi

upstream_version="$(git show upstream/main:package.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')"
node - "$upstream_version" <<'NODE'
const fs = require("node:fs");
const version = process.argv[2];
for (const file of ["package.json", "package-lock.json"]) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.name = "pi-swap-web";
  data.version = version;
  if (data.packages?.[""]) {
    data.packages[""].name = "pi-swap-web";
    data.packages[""].version = version;
    const rootBin = data.packages[""].bin ?? {};
    rootBin["pi-swap-web"] = rootBin["pi-web"] ?? "bin/pi-web.js";
    delete rootBin["pi-web"];
    data.packages[""].bin = rootBin;
  }
  if (data.bin) {
    data.bin["pi-swap-web"] = data.bin["pi-web"] ?? "bin/pi-web.js";
    delete data.bin["pi-web"];
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
NODE
if ! git diff --quiet -- package.json package-lock.json; then
  git add package.json package-lock.json
  git commit -m "chore: sync upstream pi-web version ${upstream_version}"
fi

echo "Installing dependencies and building in this isolated worktree..."
npm ci --ignore-scripts --registry=https://registry.npmmirror.com --fetch-retries=5 --fetch-retry-maxtimeout=120000 --fetch-timeout=600000
env -u TURBOPACK npm run build
test -s .next/BUILD_ID || { echo "Build did not produce .next/BUILD_ID" >&2; exit 1; }
echo "Build passed at $(git rev-parse --short HEAD), version ${upstream_version}. Production service was not touched."
