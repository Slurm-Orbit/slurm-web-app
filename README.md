# Slurm Orbital

A web console for Slurm clusters. A small agent runs on the cluster and dials out to a gateway served by the Nuxt app, so no inbound port has to be opened on the cluster.

## Architecture

```
┌──────────┐    WebSocket    ┌──────────────────┐    WebSocket    ┌──────────────┐
│ Browser  │ ──────────────► │ Gateway (Nitro)  │ ──────────────► │ Agent (CLI)  │
│  Nuxt    │ ◄────────────── │   Socket.IO      │ ◄────────────── │  slurmjs     │
└──────────┘                 └──────────────────┘                 └──────────────┘
                                                                          │
                                                                          ▼
                                                              squeue / sacct / sinfo
                                                              scontrol / sacctmgr / sstat
```

- **Gateway** — Socket.IO server inside the Nitro process. Registers agents, keeps the browser session, relays requests both ways.
- **Agent** — runs where the Slurm commands are available (usually a login node) and returns `slurmjs` results.
- **Auth** — the browser submits an access key, the gateway forwards it to the agent, and only then binds the session.

## Requirements

- **Frontend** — Node.js `^22.22.3`, `^24.15.0` or `>=26` (Nuxt), plus [Bun](https://bun.com)
- **Agent** — Node.js `>=22.12` (Commander) with `squeue`, `sbatch`, `scancel`, `sinfo`, `sacct`, `sstat`, `scontrol` and `sacctmgr` on `PATH`

## Quick start

```bash
# 1. gateway
cd frontend
bun install
bun dev              # http://localhost:3000

# 2. agent, on the cluster
cd backend
bun install
node server.js start http://<gateway>:3000
```

The agent prints its identity and access key:

```
[agent] identity gpu-login01
[agent] access key 3f2c8a1e-...
```

Enter that key on the gateway page to open the cluster console.

| Flag | Default | Description |
| --- | --- | --- |
| `-n, --name <name>` | hostname | Backend display name |
| `-p, --password <key>` | random UUID | Fixed access key |

## Pages

| Route | Content |
| --- | --- |
| `/` | Online backends, access key entry |
| `/console/:id` | Cluster summary: partitions, node and job counts, backend info |
| `/console/:id/jobs` | Queue and history, state filter, hold / release / cancel |
| `/console/:id/jobs/new` | Script editor, submit with `sbatch` |
| `/console/:id/jobs/:jobId` | Lifecycle timeline, live usage, stdout / stderr |
| `/console/:id/nodes` | Nodes grouped by partition |
| `/console/:id/nodes/:nodeName` | Node usage and state changes |
| `/console/:id/accounts` | Account tree, editable as root |

## Permissions

- The agent compares the access key; the gateway stores no credentials.
- Node state changes and account management appear only when the agent runs as root.
- **Writes are not authorized server-side.** Root is a UI check only, so deploy on a trusted network or run the agent as a normal user.

## Layout

```
backend/server.js              agent: register, auth, Slurm event relay
frontend/
  app/
    composables/               useGateway (socket + request), useAction, usePageRefresh
    layouts/console.vue        sidebar, refresh control, offline banner
    middleware/console-auth.js session check
    pages/                     routes
    utils/format.js            formatting and state colors
  server/plugins/socket.io.js  gateway: registry, sessions, relay
```

## Development

```bash
bun run build     # production build
bun run lint      # requires dependencies installed, .nuxt holds the generated config
bun run lint:fix
```

Theme colors live in the `@theme` block of `frontend/app/assets/css/main.css` as `--color-orbit-*`.

| Layer | Stack |
| --- | --- |
| Framework | Nuxt 4 / Vue 3 |
| Styles | Tailwind CSS 4 (CSS-first theme) |
| Transport | Socket.IO 4 + engine.io |
| Cluster | [slurmjs](https://www.npmjs.com/package/slurmjs) |
| CLI | Commander |

## License

[Apache License 2.0](./LICENSE)
