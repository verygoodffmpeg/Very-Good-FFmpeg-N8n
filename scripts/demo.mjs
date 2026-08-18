#!/usr/bin/env node
// Drives a human-paced demo of the community node in a real browser, for the
// n8n verification screen recording. The user records the browser window with
// Loom while this script drives it.
//
//   node scripts/demo.mjs prep   # fresh-instance setup: owner + xAI credential
//   node scripts/demo.mjs        # run the on-camera demo (headed browser)
//
// Env: HEADLESS=1 for a headless rehearsal, XAI_API_KEY for prep.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, selectors } from '@playwright/test';

// n8n marks elements with data-test-id, not Playwright's default data-testid.
selectors.setTestIdAttribute('data-test-id');

const BASE = 'http://localhost:5678';
const PKG = '@verygoodffmpeg/n8n-nodes-verygoodffmpeg';
const OWNER = { email: 'demo@verygoodffmpeg.com', password: 'VgfDemo1234!' };
const SAMPLE = 'https://storage.verygoodffmpeg.com/sample.mp4';
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Reads VGF_API_KEY from test/.env.test.
function vgfApiKey() {
	const env = readFileSync(path.join(repoRoot, 'test', '.env.test'), 'utf8');
	const m = env.match(/^VGF_API_KEY=(.+)$/m);
	if (!m) throw new Error('VGF_API_KEY not found in test/.env.test');
	return m[1].trim();
}

// One-time setup on a fresh instance: owner account and the xAI credential.
async function prep() {
	const xaiKey = process.env.XAI_API_KEY;
	if (!xaiKey) throw new Error('Set XAI_API_KEY for prep');

	const res = await fetch(`${BASE}/rest/owner/setup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: OWNER.email,
			firstName: 'Seb',
			lastName: 'Baker',
			password: OWNER.password,
		}),
	});
	console.log(`owner setup: ${res.status}`);
	const cookie = res.headers.get('set-cookie')?.split(';')[0];
	if (!cookie) throw new Error('No session cookie from owner setup (already set up? wipe with: docker volume rm n8n_demo)');

	const cred = await fetch(`${BASE}/rest/credentials`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name: 'xAI account', type: 'xAiApi', data: { apiKey: xaiKey } }),
	});
	console.log(`xAI credential: ${cred.status}`);
}

// Small pacing helpers so the drive reads as a person, not a script.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function makeHelpers(page) {
	// Fake cursor dot: Playwright moves a virtual mouse that renders nothing.
	await page.addInitScript(() => {
		window.addEventListener('DOMContentLoaded', () => {
			const dot = document.createElement('div');
			dot.style.cssText =
				'position:fixed;z-index:2147483647;width:16px;height:16px;border-radius:50%;' +
				'background:rgba(30,30,30,.75);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);' +
				'pointer-events:none;left:-30px;top:-30px;transition:left .02s,top .02s';
			document.body.appendChild(dot);
			document.addEventListener('mousemove', (e) => {
				dot.style.left = `${e.clientX - 8}px`;
				dot.style.top = `${e.clientY - 8}px`;
			}, true);
		});
	});

	const move = async (locator) => {
		const box = await locator.boundingBox();
		if (!box) throw new Error('No bounding box for locator');
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
	};
	const click = async (locator, settle = 500) => {
		await locator.waitFor({ state: 'visible' });
		await move(locator);
		await sleep(350);
		await locator.click();
		await sleep(settle);
	};
	const type = async (locator, text) => {
		await click(locator, 200);
		await page.keyboard.type(text, { delay: 55 });
		await sleep(300);
	};
	return { move, click, type };
}

async function demo() {
	const headless = process.env.HEADLESS === '1';
	const browser = await chromium.launch({ headless });
	const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
	globalThis.__demoPage = page;
	const h = await makeHelpers(page);

	// Sign in (off camera) and land on the workflows screen.
	await page.goto(`${BASE}/signin`);
	await page.getByRole('textbox', { name: /email/i }).fill(OWNER.email);
	await page.locator('input[type="password"]').fill(OWNER.password);
	await page.getByRole('button', { name: /sign in/i }).click();
	await page.waitForURL(/home|workflow/, { timeout: 30_000 });
	await sleep(1000);

	// Give the operator time to start the screen recording.
	console.log('\n=== START RECORDING NOW — demo begins in 10 seconds ===\n');
	await sleep(10_000);

	// 1. Install the node from npm via Settings > Community Nodes.
	// SKIP_INSTALL=1 jumps past this during rehearsals on a warm instance.
	if (process.env.SKIP_INSTALL !== '1') {
	await page.goto(`${BASE}/settings/community-nodes`);
	await sleep(1200);
	await h.click(page.getByRole('button', { name: /install/i }).first());
	const pkgInput = page.getByRole('dialog').locator('input').first();
	await h.type(pkgInput, PKG);
	await h.click(page.getByText(/I understand the risks/i).first(), 300);
	await h.click(page.getByRole('dialog').getByRole('button', { name: /install/i }));
	// npm install inside the container takes a while.
	await page.getByText(PKG, { exact: false }).first().waitFor({ timeout: 240_000 });
	await sleep(2500);
	}

	// 2. New workflow, insert the node.
	await page.goto(`${BASE}/workflow/new`);
	await sleep(1500);
	// Dismiss the personalization survey if the instance shows it.
	const survey = page.getByRole('button', { name: /get started/i });
	if (await survey.isVisible().catch(() => false)) {
		await survey.click();
		await sleep(1000);
	}
	await h.click(page.getByRole('button', { name: 'Open nodes panel' }));
	const searchBar = page
		.locator('[data-test-id="node-creator-search-bar"] input, input[data-test-id="node-creator-search-bar"]')
		.first();
	await h.type(searchBar, 'Very Good FFmpeg');
	await h.click(page.getByText('Very Good FFmpeg', { exact: true }).first(), 900);
	await sleep(1200);
	// The npm-installed panel shows "Node details" with a version line and a
	// collapsible Actions section; the actions search bar variant has neither.
	const listJobsItem = page.getByText('List jobs', { exact: true }).first();
	if (!(await listJobsItem.isVisible().catch(() => false))) {
		const actionsHeader = page.getByText(/^Actions \(\d+\)/).first();
		const actionsSearch = page.getByPlaceholder(/Search .* Actions/i);
		if (await actionsSearch.isVisible().catch(() => false)) {
			await h.type(actionsSearch, 'List jobs');
		} else if (await actionsHeader.isVisible().catch(() => false)) {
			await h.click(actionsHeader, 800);
		}
	}
	await h.click(listJobsItem, 1200);

	// 3. Create the credential; the on-save test hits the real API. Skipped
	// automatically when a warm rehearsal instance already stores one.
	const setupCredential = page
		.getByRole('button', { name: 'Set up credential' })
		.or(page.locator('[data-test-id=\"setup-credential-button\"]'))
		.first();
	const needsCredential = await setupCredential
		.waitFor({ state: 'visible', timeout: 10_000 })
		.then(() => true)
		.catch(() => false);
	if (needsCredential) {
		await h.click(setupCredential, 1000);
		const apiKeyInput = page
			.locator('[data-test-id="parameter-input-apiKey"] input')
			.or(page.getByRole('dialog').locator('input[type="password"]'))
			.first();
		await h.type(apiKeyInput, vgfApiKey());
		await h.click(
			page.locator('[data-test-id=\"credential-save-button\"]').or(page.getByRole('button', { name: /^save$/i })).first(),
			500,
		);
		// Show the saved/tested state briefly, then close the modal if it did
		// not close itself.
		await sleep(2000);
		if (await apiKeyInput.isVisible().catch(() => false)) {
			await h.click(
				page.locator('[data-test-id="editCredential-modal"] .el-dialog__close, [data-test-id="editCredential-modal"] [aria-label="Close"]').first(),
				800,
			);
		}
	}

	// 4a. Execute List Jobs from the open node view and show the output.
	if (process.env.DEMO_DEBUG === '1') {
		const btns = await page
			.locator('[data-test-id="ndv"] button, [data-test-id="ndv"] [role="button"]')
			.evaluateAll((els) =>
				els.map((b) => ({
					text: b.innerText.trim().slice(0, 40),
					aria: b.getAttribute('aria-label'),
					dt: b.getAttribute('data-test-id'),
					vis: !!(b.offsetWidth || b.offsetHeight),
				})),
			);
		console.log('NDV buttons:', JSON.stringify(btns.filter((b) => b.vis), null, 1));
	}
	await h.click(page.locator('[data-test-id="ndv"] [data-test-id="node-execute-button"]').first(), 1500);
	await page.getByText(/\d+ items?/).first().waitFor({ timeout: 120_000 });
	await sleep(3500);

	// Reusable pickers for the NDV operation dropdown.
	const pickOperation = async (label) => {
		await h.click(page.locator('[data-test-id="parameter-input-operation"]').first(), 600);
		await h.click(
			page
				.locator('.el-select-dropdown__item, [role="option"]')
				.filter({ visible: true })
				.filter({ has: page.getByText(label, { exact: true }) })
				.first(),
			800,
		);
	};
	const executeStep = async () => {
		await h.click(page.locator('[data-test-id="ndv"] [data-test-id="node-execute-button"]').first(), 1000);
	};

	// 4b. Get a single job, using a real ID scraped from the List output.
	const ndvText = await page.locator('[data-test-id="ndv"]').innerText();
	const jobId = ndvText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
	if (!jobId) throw new Error('No job id found in List output');
	await pickOperation('Get');
	await h.type(page.locator('[data-test-id="parameter-input-jobId"] input').first(), jobId);
	await executeStep();
	await page.getByText('1 item').first().waitFor({ timeout: 60_000 });
	await sleep(3000);

	// 4c. Switch to Run and transcode the sample clip for real.
	// SKIP_RUN=1 skips the transcode during rehearsals.
	if (process.env.SKIP_RUN !== '1') {
	await h.click(page.locator('[data-test-id="parameter-input-operation"]').first(), 600);
	if (process.env.DEMO_DEBUG === '1') {
		const opts = await page
			.locator('.el-select-dropdown__item, [role="option"]')
			.evaluateAll((els) =>
				els.map((e) => ({ text: e.innerText.trim().slice(0, 60), vis: !!(e.offsetWidth || e.offsetHeight) })),
			);
		console.log('operation options:', JSON.stringify(opts.filter((o) => o.vis)));
	}
	await h.click(
		page
			.locator('.el-select-dropdown__item, [role="option"]')
			.filter({ visible: true })
			.filter({ has: page.getByText('Run', { exact: true }) })
			.first(),
		800,
	);
	await h.click(page.getByRole('button', { name: /add input file/i }), 500);
	const paramInputs = page.locator('[data-test-id="parameter-input-field"]');
	await h.type(page.locator('[data-test-id="parameter-input-key"] input').first(), 'input');
	await h.type(page.locator('[data-test-id="parameter-input-url"] input').first(), SAMPLE);
	await h.click(page.getByRole('button', { name: /add output/i }), 400);
	await h.type(page.getByPlaceholder('output1.mp4').first(), 'output.mp4');
	await h.click(page.getByRole('button', { name: /add command/i }), 400);
	await h.type(page.getByPlaceholder(/-i \{\{input1\}\}/).first(), '-i {{input}} -t 5 {{output.mp4}}');
	// Wait for Completion toggle.
	await h.click(page.locator('[data-test-id="parameter-input-wait"] input, [data-test-id="parameter-input-wait"]').first(), 400);
	await h.click(page.locator('[data-test-id="ndv"] [data-test-id="node-execute-button"]').first(), 1000);
	// Stale output from the Get demo also says "succeeded": wait for the
	// executing state to appear and clear before trusting that text.
	await page.getByText(/executing/i).first().waitFor({ timeout: 20_000 }).catch(() => {});
	await page.getByText(/executing/i).first().waitFor({ state: 'hidden', timeout: 180_000 }).catch(() => {});
	await page.getByText('succeeded').first().waitFor({ timeout: 180_000 });
	await sleep(3500);
	}
	await h.click(page.locator('[data-test-id="ndv-close-button"]').first(), 800);

	// 5. Upload a file from workflow binary data: Manual Trigger > HTTP Request
	// (downloads the sample as binary) > File Upload.
	await page.goto(`${BASE}/workflow/new`);
	await sleep(1500);
	await h.click(page.getByRole('button', { name: 'Open nodes panel' }));
	await h.type(searchBar, 'manual');
	await h.click(page.getByText(/manual/i).filter({ visible: true }).first(), 1200);

	await h.click(page.locator('[data-test-id="canvas-plus-button"], [data-test-id="canvas-handle-plus"]').first(), 1000);
	await h.type(searchBar, 'HTTP Request');
	await h.click(page.getByText('HTTP Request', { exact: true }).first(), 2000);
	await h.type(page.locator('[data-test-id="parameter-input-url"] input').first(), SAMPLE);
	await h.click(page.locator('[data-test-id="ndv-close-button"]').first(), 800);

	await h.click(page.locator('[data-test-id="canvas-handle-plus"]').last(), 1000);
	await h.type(searchBar, 'Very Good FFmpeg');
	await h.click(page.getByText('Very Good FFmpeg', { exact: true }).first(), 900);
	await sleep(1200);
	const uploadItem = page.getByText('Upload a file', { exact: true }).first();
	if (!(await uploadItem.isVisible().catch(() => false))) {
		const hdr = page.getByText(/^Actions \(\d+\)/).first();
		if (await hdr.isVisible().catch(() => false)) await h.click(hdr, 800);
	}
	await h.click(uploadItem, 1500);
	// Run the whole chain: download sample > upload to VGF > download_url out.
	await h.click(page.locator('[data-test-id="ndv"] [data-test-id="node-execute-button"]').first(), 1000);
	await page.getByText('download_url').first().waitFor({ timeout: 120_000 });
	await sleep(3500);
	await h.click(page.locator('[data-test-id="ndv-close-button"]').first(), 800);

	// 6. Webhook trigger: listen for a test event, then submit a job (via the
	// API, off camera) whose completion callback fires the trigger for real.
	await page.goto(`${BASE}/workflow/new`);
	await sleep(1500);
	await h.click(page.getByRole('button', { name: 'Open nodes panel' }));
	await h.type(searchBar, 'Very Good FFmpeg');
	await h.click(page.getByText('Very Good FFmpeg', { exact: true }).first(), 1200);
	await h.click(page.getByText('On new Very Good FFmpeg event', { exact: false }).first(), 2000);

	// Expand the Webhook URLs section and read the public test-webhook URL.
	await h.click(page.getByText('Webhook URLs', { exact: false }).first(), 1200);
	const trigNdvText = await page.locator('[data-test-id="ndv"]').innerText();
	const webhookUrl = trigNdvText.match(/https?:\/\/\S*webhook-test\S*/)?.[0];
	if (!webhookUrl) throw new Error('No test webhook URL found in trigger NDV');

	// Start listening, then submit a tiny job pointing at the webhook.
	await h.click(page.locator('[data-test-id="ndv"] [data-test-id="node-execute-button"]').first(), 1500);
	const submit = await fetch('https://verygoodffmpeg.com/api/ffmpeg', {
		method: 'POST',
		headers: { Authorization: `Bearer ${vgfApiKey()}` },
		body: JSON.stringify({
			input_files: { input: SAMPLE },
			output_files: ['output.mp4'],
			ffmpeg_commands: ['-i {{input}} -t 2 {{output.mp4}}'],
			webhook_url: webhookUrl,
		}),
	});
	if (!submit.ok) throw new Error(`Webhook demo job submit failed: ${submit.status}`);
	// The completion callback lands here and shows the job payload.
	await page.getByText('succeeded').first().waitFor({ timeout: 180_000 });
	await sleep(4000);
	await h.click(page.locator('[data-test-id="ndv-close-button"]').first(), 800);

	// 7. AI Agent using the node as a tool.
	await page.goto(`${BASE}/workflow/new`);
	await sleep(1500);
	await h.click(page.getByRole('button', { name: 'Open nodes panel' }));
	await h.type(searchBar, 'AI Agent');
	await h.click(page.getByText('AI Agent', { exact: true }).first(), 2000);
	await h.click(page.locator('[data-test-id=\"ndv-close-button\"]').first(), 1000);

	// Sub-node connector "+" buttons under the agent: 0 = Chat Model, 2 = Tool.
	const subNodePlus = page.locator(
		'[class*="canvas-node-handle-non-main-input"] [data-test-id="canvas-handle-plus"]',
	);

	// Attach the chat model and pick a tool-capable model.
	await h.click(subNodePlus.nth(0), 1200);
	await h.type(searchBar, 'xAI Grok');
	await h.click(page.getByText('xAI Grok Chat Model', { exact: false }).first(), 2000);
	await h.click(page.locator('[data-test-id="parameter-input-model"] input').first(), 800);
	await h.click(
		page.getByText('grok-4.6', { exact: true }).filter({ visible: true }).first(),
		800,
	);
	await h.click(page.locator('[data-test-id=\"ndv-close-button\"]').first(), 1000);

	// Attach the Very Good FFmpeg node as a tool (List Jobs action).
	await h.click(subNodePlus.last(), 1200);
	await h.type(searchBar, 'Very Good FFmpeg');
	await h.click(page.getByText('Very Good FFmpeg Tool', { exact: false }).first(), 2000);
	// Point the tool at the List operation.
	await h.click(page.locator('[data-test-id="parameter-input-operation"]').first(), 600);
	await h.click(
		page
			.locator('.el-select-dropdown__item, [role="option"]')
			.filter({ visible: true })
			.filter({ has: page.getByText('List', { exact: true }) })
			.first(),
		800,
	);
	await h.click(page.locator('[data-test-id=\"ndv-close-button\"]').first(), 1000);

	// Chat with the agent; it should call the tool and answer with real jobs.
	await h.click(page.getByRole('button', { name: /open chat/i }).first(), 1200);
	const chatInput = page
		.locator('[data-test-id="chat-input"] textarea, [data-test-id="chat-input"], textarea[placeholder*="message" i]')
		.first();
	await h.type(chatInput, 'List my recent FFmpeg jobs and tell me the status of the most recent one.');
	await page.keyboard.press('Enter');
	await page.getByText(/succeeded|queued|running|cancelled/).first().waitFor({ timeout: 180_000 });
	await sleep(6000);

	console.log('\n=== DEMO COMPLETE — stop the recording ===\n');
	if (!headless) await sleep(60_000);
	await browser.close();
}

const phase = process.argv[2];
if (phase === 'prep') await prep();
else {
	try {
		await demo();
	} catch (err) {
		// Screenshot on failure so a broken selector is diagnosable.
		const shot = process.env.DEMO_SHOT ?? '/tmp/demo-fail.png';
		try {
			const pages = (await import('@playwright/test')).chromium;
			void pages;
		} catch {}
		if (globalThis.__demoPage) {
			await globalThis.__demoPage.screenshot({ path: shot, fullPage: false });
			const modals = await globalThis.__demoPage.evaluate(() =>
				[...(document.querySelector('#app-modals')?.children ?? [])].map((el) => ({
					cls: el.className,
					testId: el.getAttribute('data-test-id'),
					rect: el.getBoundingClientRect().toJSON(),
				})),
			).catch(() => 'modal dump failed');
			console.error('app-modals children:', JSON.stringify(modals, null, 1));
		}
		console.error(err);
		process.exit(1);
	}
}
