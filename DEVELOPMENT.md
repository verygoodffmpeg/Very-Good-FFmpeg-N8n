# Development

## Local setup (requires Docker)

1. `pnpm install`
2. Copy `test/.env.test.example` to `test/.env.test` and set `VGF_API_KEY`.
3. `pnpm build`
4. `node scripts/start-n8n.mjs` to start n8n (Docker) with the built node mounted.
5. Open [http://localhost:5678](http://localhost:5678). On first boot you will be prompted to create a local owner account.
6. Done. Add a **Very Good FFmpeg** node on a workflow canvas to try it. After code changes, rebuild and restart the script.

n8n caches node icons and definitions aggressively. If changes don't show after a restart, hard-reload the browser tab.

## Checks

```bash
pnpm lint      # n8n community-node verification rules (strict)
pnpm test      # e2e API tests: drives the node's execute() against the real VGF API
pnpm test:ui   # Playwright: boots n8n itself (Docker), creates owner + credential + workflow in the UI, runs a real List Jobs operation
```

Each check is repeatable. `pnpm test:ui` needs no running instance: if port 5678 is free it will build and start one via `scripts/start-n8n.mjs`, and it passes on both a fresh and an existing instance. To reset the local n8n completely, run `docker compose down -v`.

## Updating the vendored SDK

The SDK source is vendored into `nodes/Vgf/vendor/sdk` rather than installed as a runtime dependency, because n8n verification forbids external packages. When the upstream TypeScript SDK changes, run:

```bash
pnpm sync-sdk              # or SDK_REF=v1.2.3 pnpm sync-sdk
```
