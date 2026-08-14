#!/usr/bin/env node
// Starts local n8n (Docker) with the built package mounted as a custom node.
// Run `pnpm build` first so dist/ is current. Used by `pnpm test:ui`
// (Playwright webServer, which chains the build) and manual dev.

import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// dist/ is what n8n loads; fail fast if it has not been built.
if (!existsSync(join(repoRoot, 'dist', 'nodes'))) {
	console.error('dist/ not found — run `pnpm build` first.');
	process.exit(1);
}

// Recreate the container each start: the build wipes dist/, which leaves an
// existing container's bind mount pointing at the deleted directory. Workflow
// and credential data survive in the named volume.
const child = spawn('docker', ['compose', 'up', '--force-recreate'], {
	cwd: repoRoot,
	stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
