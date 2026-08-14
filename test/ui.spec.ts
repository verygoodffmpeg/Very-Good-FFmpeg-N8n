/* eslint-disable -- dev-only file, excluded from the published package */
/**
 * Playwright UI check: verifies the community node loads and runs in a real n8n instance.
 */
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '.env.test'), quiet: true });

const OWNER = {
	email: 'e2e@verygoodffmpeg.com',
	firstName: 'E2E',
	lastName: 'Test',
	password: 'E2eTest1234!',
};

// Signs in, creating the owner account on a fresh instance.
async function authenticate(page: import('@playwright/test').Page) {
	await page.goto('/');
	// A cold instance serves a "starting up" splash before the app is ready.
	await expect(async () => {
		if (await page.getByText('n8n is starting up').isVisible()) {
			await page.reload();
			throw new Error('n8n still starting');
		}
	}).toPass({ timeout: 120_000, intervals: [3_000] });
	await page.waitForURL(/setup|signin|home|workflow/, { timeout: 60_000 });

	if (page.url().includes('/setup')) {
		await page.getByRole('textbox', { name: /email/i }).fill(OWNER.email);
		await page.getByRole('textbox', { name: /first name/i }).fill(OWNER.firstName);
		await page.getByRole('textbox', { name: /last name/i }).fill(OWNER.lastName);
		await page.locator('input[type="password"]').fill(OWNER.password);
		await page.getByRole('button', { name: /next|create|sign up/i }).click();
	} else if (page.url().includes('/signin')) {
		await page.getByRole('textbox', { name: /email/i }).fill(OWNER.email);
		await page.locator('input[type="password"]').fill(OWNER.password);
		await page.getByRole('button', { name: /sign in/i }).click();
	}

	await page.waitForURL(/home|workflow/, { timeout: 60_000 });
}

test('Very Good FFmpeg node runs a List Jobs operation in the n8n UI', async ({ page }) => {
	const apiKey = process.env.VGF_API_KEY;
	expect(apiKey, 'VGF_API_KEY must be set in test/.env.test').toBeTruthy();

	await authenticate(page);

	// Open a fresh workflow canvas; wait for the node-type registry to arrive
	// before opening the creator, or its search runs against an empty index.
	const typesLoaded = page.waitForResponse((r) => r.url().includes('/types/nodes.json'), {
		timeout: 120_000,
	});
	await page.goto('/workflow/new');
	await typesLoaded;

	// Find the community node; its presence in the creator proves it loaded.
	// Reopen the panel per attempt: a panel opened too early caches no results.
	const searchBar = page
		.locator('[data-test-id="node-creator-search-bar"] input, input[data-test-id="node-creator-search-bar"]')
		.first();
	const nodeItem = page.getByText('Very Good FFmpeg', { exact: true });
	await expect(async () => {
		await page.keyboard.press('Escape');
		await page.getByRole('button', { name: 'Open nodes panel' }).click();
		await searchBar.fill('Very Good FFmpeg');
		await expect(nodeItem.first()).toBeVisible({ timeout: 5_000 });
	}).toPass({ timeout: 90_000, intervals: [2_000] });
	await nodeItem.first().click();

	// The subpanel lists the trigger and the five actions.
	await expect(page.getByText('On new Very Good FFmpeg event')).toBeVisible();
	await page.getByPlaceholder(/Search Very Good FFmpeg Actions/i).fill('List jobs');
	await page.getByText('List jobs', { exact: true }).first().click();

	// NDV opens (n8n auto-inserts a manual trigger). Create the credential
	// inline unless a previous run of this check already stored one.
	const setupCredential = page
		.getByRole('button', { name: 'Set up credential' })
		.or(page.getByTestId('setup-credential-button'))
		.first();
	const needsCredential = await setupCredential
		.waitFor({ state: 'visible', timeout: 10_000 })
		.then(() => true)
		.catch(() => false);
	if (needsCredential) {
		await setupCredential.click();
		const apiKeyInput = page
			.locator('[data-test-id="parameter-input-apiKey"] input')
			.or(page.getByRole('dialog').locator('input[type="password"]'))
			.first();
		await apiKeyInput.fill(apiKey!);
		await page
			.getByTestId('credential-save-button')
			.or(page.getByRole('button', { name: /^save$/i }))
			.first()
			.click();
		// The modal closes itself once the credential is stored.
		await expect(apiKeyInput).toBeHidden({ timeout: 30_000 });
	}

	// Saving the credential closes the NDV; run the whole workflow from the
	// canvas and expect the List Jobs node to emit items against the real API.
	// Promo/survey popups can cover the canvas; dismiss and retry the click.
	await expect(async () => {
		await page.keyboard.press('Escape');
		await page
			.getByRole('button', { name: 'Execute workflow' })
			.filter({ visible: true })
			.last()
			.click({ timeout: 5_000 });
	}).toPass({ timeout: 60_000, intervals: [2_000] });
	await expect(page.getByText(/\d+ items?/).first()).toBeVisible({ timeout: 120_000 });
	await expect(page.getByText(/Problem in node|error/i)).toHaveCount(0);
});