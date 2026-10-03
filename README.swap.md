# pi-swap-web

这是基于 [agegr/pi-web](https://github.com/agegr/pi-web) 的本地定制版：

- 应用名称和 PWA 名称：`pi-swap-web`
- 命令：`pi-swap-web`
- 默认端口：`30141`
- 与原 Pi 共用 `~/.pi/agent`、模型配置和会话
- 使用 `upstream` Git 远程保留与 pi-web 的更新通道

## 开发运行

要求 Node.js `>=22.19.0`：

```bash
npm install
npm run dev
```

生产运行：

```bash
npm run build
npm start
```

也可以使用构建后的命令：

```bash
node bin/pi-swap-web.js
```

## 同步 pi-web 更新

本项目的 `pi-swap-web` 分支位于上游 `upstream/main` 之上，本地定制以 Git 提交保存。更新时运行：

```bash
npm run update:upstream
```

该命令会：

1. 拉取 `https://github.com/agegr/pi-web.git` 的最新代码；
2. 将本地定制 rebase 到上游；
3. 更新依赖；
4. 重新构建。

如果上游和本地定制改动了同一位置，命令会暂停并提示解决 Git 冲突，不会静默覆盖本地代码。

远程仓库关系：

```text
upstream -> agegr/pi-web（上游）
origin   -> 你的个人 fork（可选）
```

如果暂时没有自己的 fork，仅保留 `upstream` 也可以正常更新。
