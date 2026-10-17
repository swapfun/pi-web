# pi-swap-web

This is the local, branded build of [agegr/pi-web](https://github.com/agegr/pi-web). It keeps upstream features while adding the local workspace, usage and UI customizations listed in [`docs/swap-v0.12.1-feature-port.md`](docs/swap-v0.12.1-feature-port.md).

- App/PWA name and command: `pi-swap-web`
- Shares `~/.pi/agent`, model settings and sessions with the pi CLI and pi-web
- Tracks upstream through the `upstream` Git remote
- Package version follows upstream (`0.12.2` for this baseline)

## Development

Requires Node.js `>=22.19.0`.

```bash
npm ci
npm run dev
```

Build and run:

```bash
npm run build
node bin/pi-swap-web.js --hostname 127.0.0.1 --port 30143 --no-open
```

The launcher accepts the upstream pi-web options. Binding to a LAN address exposes the service to that network; configure password authentication/HTTPS or use a trusted VPN.

## Upstream tracking

The `pi-swap-web-v0.12.2` development branch starts at upstream v0.12.2. Local features should be committed separately on top of upstream. Before deployment, update and build in an isolated worktree; do not replace the active production `.next` during a build. Pause `pi-swap-web-guard.timer` before stopping the service and restore it only after build and `/login` health checks pass.
