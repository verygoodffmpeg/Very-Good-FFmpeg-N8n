/**
 * Vitest config for e2e tests against the real VGF API.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		setupFiles: ['test/setup.ts'],
		testTimeout: 300_000,
		hookTimeout: 30_000,
		pool: 'forks',
		maxForks: 1,
		sequence: { concurrent: false },
	},
});