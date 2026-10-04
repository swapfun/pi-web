#!/usr/bin/env bash
# Keep pi-swap-web on top of the upstream pi-web project while retaining
# local branding/customization commits.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# The repository is also used by the personalized 30142 development service.
# Never replace its dependencies or .next output while it is running.
SERVICE_NAME="${PI_SWAP_WEB_SERVICE:-pi-swap-web-30142.service}"
service_was_active=0
update_succeeded=0

restore_service() {
  local status=$?
  if (( service_was_active && update_succeeded )); then
    if ! systemctl --user start "$SERVICE_NAME"; then
      echo "警告：更新后无法重新启动 $SERVICE_NAME。" >&2
    fi
  elif (( service_was_active )); then
    echo "更新未成功，暂不自动启动 $SERVICE_NAME；请先检查或回滚，再手动启动。" >&2
  fi
  if (( status != 0 )); then
    echo "更新失败。保留当前状态；如需回滚，可使用备份标签（若已创建）。" >&2
  fi
  exit "$status"
}
trap restore_service EXIT

branch="$(git branch --show-current)"
if [[ "$branch" != "pi-swap-web" ]]; then
  echo "错误：请在 pi-swap-web 分支上运行此命令（当前：${branch:-分离 HEAD}）" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "错误：工作区有未提交改动，请先提交或暂存：" >&2
  git status --short >&2
  exit 1
fi

if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "错误：缺少 upstream 远程仓库。可执行：" >&2
  echo "  git remote add upstream https://github.com/agegr/pi-web.git" >&2
  exit 1
fi

echo "正在检查上游 pi-web 更新……"
git fetch upstream main --tags
before="$(git rev-parse HEAD)"
upstream_head="$(git rev-parse upstream/main)"
base="$(git merge-base HEAD upstream/main)"

if [[ "$base" == "$upstream_head" ]]; then
  echo "上游没有新提交。"
  exit 0
fi

backup_tag="backup-before-upstream-$(date +%Y%m%d-%H%M%S)"
while git rev-parse --verify --quiet "refs/tags/$backup_tag" >/dev/null; do
  backup_tag="${backup_tag}-1"
done
git tag "$backup_tag" "$before"
echo "已创建回滚标签：$backup_tag"

if systemctl --user is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  service_was_active=1
  echo "正在停止 $SERVICE_NAME，避免更新期间读取半成品……"
  systemctl --user stop "$SERVICE_NAME"
fi

echo "正在把本地定制 rebase 到 upstream/main……"
if ! git rebase upstream/main; then
  cat >&2 <<'EOF'

上游更新与本地定制发生冲突。
请解决冲突后执行：
  git add <已解决的文件>
  git rebase --continue
完成后重新执行：npm run update:upstream
取消本次更新：git rebase --abort
EOF
  exit 1
fi

# Keep Next's built-in app-update check meaningful: the branded package uses
# the upstream release number, while its package name remains pi-swap-web.
upstream_version="$(git show upstream/main:package.json | node -e '
let input = "";
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => process.stdout.write(JSON.parse(input).version));
')"
node - "$upstream_version" <<'NODE'
const fs = require("node:fs");
const version = process.argv[2];
for (const file of ["package.json", "package-lock.json"]) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.version = version;
  if (data.packages?.[""]) data.packages[""].version = version;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
NODE
if ! git diff --quiet -- package.json package-lock.json; then
  git add package.json package-lock.json
  git commit -m "chore: sync upstream pi-web version ${upstream_version}"
fi

echo "正在同步依赖并重新构建……"
npm ci --ignore-scripts
# The pi shell may export TURBOPACK=1; the package script explicitly selects
# webpack, so remove the conflicting inherited flag for a deterministic build.
env -u TURBOPACK npm run build
update_succeeded=1

after="$(git rev-parse HEAD)"
if [[ "$before" == "$after" ]]; then
  echo "更新完成（代码未发生变化）。"
else
  echo "更新完成：$(git rev-parse --short "$before") -> $(git rev-parse --short "$after")"
fi
echo "启动：npm start 或 pi-swap-web"
