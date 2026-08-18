/* eslint-disable -- dev-only file, excluded from the published package */
/**
 * Playwright config for the n8n UI end-to-end check.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testMatch: 'test/ui.spec.ts',
	timeout: 300_000,
	workers: 1,
	expect: { timeout: 20_000 },
	use: {
		testIdAttribute: 'data-test-id',
		baseURL: 'http://localhost:5678',
		actionTimeout: 20_000,
		trace: 'retain-on-failure',
	},
	webServer: {
		command: 'pnpm build && node scripts/start-n8n.mjs',
		url: 'http://localhost:5678/healthz/readiness',
		reuseExistingServer: true,
		timeout: 600_000,
	},
});