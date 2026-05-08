# Known Issues

## Resolved Issues

### [BullMQ Queue Hangs On Windows Localhost Redis]
- **Status**: Resolved
- **Discovered**: 2026-05-07
- **Affects**: Keyword workflow generation and any other BullMQ enqueue path in local Windows development
- **Description**: On this Windows host, BullMQ job inserts succeeded but `queue.add(...)` could hang indefinitely when Redis was configured as `localhost`, leaving the workflow UI stuck on `Starting...` and the DB job row stranded in `PENDING`.
- **Workaround**: Use `127.0.0.1` instead of `localhost` for the Redis host in local Windows development.
- **Resolution**: `server/src/app.module.ts` now normalizes the BullMQ Redis host to `127.0.0.1` on Windows when no explicit non-local host is configured.

### [Backend Misses Repo Env When Launched From Root]
- **Status**: Resolved
- **Discovered**: 2026-05-07
- **Affects**: Keyword workflow SERP mapping, competitor discovery, and any backend integration that depends on API keys from the repo root `.env`
- **Description**: The backend could be launched either from `server/` as `node .\dist\main.js` or from the repo root as `node .\server\dist\main.js`. With `ConfigModule.forRoot({ envFilePath: '../.env' })`, the root-launched process resolved `../.env` relative to the wrong working directory and skipped the real repo `.env`, so live workflow generation behaved as if Serper/Ahrefs keys were missing even when the file contained them.
- **Workaround**: Start the backend from `server/` so `../.env` happens to resolve to the repo root.
- **Resolution**: `server/src/app.module.ts` now resolves the repo root `.env` from `__dirname` and keeps cwd-based fallbacks, so both launch styles load the same env file.

## Tracking Template

## Template

```
### [Issue Title]
- **Status**: Open / Investigating / Resolved
- **Discovered**: YYYY-MM-DD
- **Affects**: [feature / component]
- **Description**: ...
- **Workaround**: ...
- **Resolution**: ...
```
