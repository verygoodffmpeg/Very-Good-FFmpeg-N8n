/* eslint-disable -- dev-only file, excluded from the published package */
/**
 * End-to-end tests that drive the Vgf node's execute() against the real VGF API.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Vgf } from '../nodes/Vgf/Vgf.node';
import { makeExecuteContext, pollUntilTerminal, debug } from './harness';
import type { ParamMap } from './harness';

const INPUT = 'https://storage.verygoodffmpeg.com/sample.mp4';

// Executes the node once with the given params and returns the output items' json.
async function runNode(params: ParamMap, binary?: { name: string; buffer: Buffer; mimeType: string }) {
	const node = new Vgf();
	const ctx = makeExecuteContext({
		params,
		items: binary
			? [
					{
						json: {},
						binary: {
							[binary.name]: {
								data: '',
								mimeType: binary.mimeType,
								fileName: 'sample.mp4',
							},
						},
					},
				]
			: undefined,
		binaryBuffers: binary ? { [binary.name]: binary.buffer } : undefined,
	});
	const result = await node.execute.call(ctx);
	return result[0].map((item) => item.json as Record<string, unknown>);
}

// Convenience wrapper returning the first output item.
async function runNodeSingle(params: ParamMap) {
	const out = await runNode(params);
	expect(out.length).toBe(1);
	return out[0];
}

describe('job', () => {
	it('run with wait reaches succeeded', async () => {
		const job = await runNodeSingle({
			resource: 'job',
			operation: 'run',
			inputFiles: { file: [{ key: 'input', url: INPUT }] },
			outputFiles: ['output.mp4'],
			ffmpegCommands: ['-i {{input}} -t 5 {{output.mp4}}'],
			machine: 'cpu',
			wait: true,
		});

		expect(job.status).toBe('succeeded');
		expect(job.output_files).toHaveProperty('output.mp4');
	});

	it('run without wait, then get until terminal', async () => {
		const job = await runNodeSingle({
			resource: 'job',
			operation: 'run',
			inputFiles: { file: [{ key: 'input', url: INPUT }] },
			outputFiles: ['output.mp4'],
			ffmpegCommands: ['-i {{input}} -t 5 {{output.mp4}}'],
			machine: 'cpu',
			wait: false,
		});

		expect(['queued', 'running', 'succeeded']).toContain(job.status);

		const final = await pollUntilTerminal(runNodeSingle, job.id as string);
		expect(final.status).toBe('succeeded');
		expect(final.output_files).toHaveProperty('output.mp4');
	});

	it('list returns jobs and respects limit', async () => {
		const jobs = await runNode({
			resource: 'job',
			operation: 'list',
			limit: 2,
			offset: 0,
		});

		expect(jobs.length).toBeGreaterThan(0);
		expect(jobs.length).toBeLessThanOrEqual(2);
		for (const job of jobs) {
			expect(job).toHaveProperty('id');
			expect(job).toHaveProperty('status');
		}
	});

	it('cancel stops a queued job', async () => {
		const job = await runNodeSingle({
			resource: 'job',
			operation: 'run',
			inputFiles: { file: [{ key: 'input', url: INPUT }] },
			outputFiles: ['output.mp4'],
			// Long transcode so the job is still cancellable when we hit cancel.
			ffmpegCommands: ['-i {{input}} -c:v libx264 -preset veryslow {{output.mp4}}'],
			machine: 'cpu',
			wait: false,
		});
		debug(`cancelling job ${job.id as string}`);

		const cancelled = await runNodeSingle({
			resource: 'job',
			operation: 'cancel',
			jobId: job.id,
		});
		expect(['cancelled', 'cancelling']).toContain(cancelled.status);

		const final = await pollUntilTerminal(runNodeSingle, job.id as string);
		expect(final.status).toBe('cancelled');
	});
});

describe('file', () => {
	it('upload returns a usable download URL', async () => {
		const buffer = readFileSync(path.resolve(__dirname, 'fixtures/sample.mp4'));

		const out = await runNode(
			{ resource: 'file', operation: 'upload', binaryPropertyName: 'data' },
			{ name: 'data', buffer, mimeType: 'video/mp4' },
		);

		expect(out.length).toBe(1);
		const downloadUrl = out[0].download_url as string;
		expect(downloadUrl).toMatch(/^https?:\/\//);

		// The uploaded file must be retrievable, byte-for-byte identical.
		const res = await fetch(downloadUrl);
		expect(res.ok).toBe(true);
		const fetched = Buffer.from(await res.arrayBuffer());
		expect(fetched.equals(buffer)).toBe(true);
	});

	it('uploaded file works as job input', async () => {
		const buffer = readFileSync(path.resolve(__dirname, 'fixtures/sample.mp4'));

		const uploaded = await runNode(
			{ resource: 'file', operation: 'upload', binaryPropertyName: 'data' },
			{ name: 'data', buffer, mimeType: 'video/mp4' },
		);
		const downloadUrl = uploaded[0].download_url as string;

		const job = await runNodeSingle({
			resource: 'job',
			operation: 'run',
			inputFiles: { file: [{ key: 'input', url: downloadUrl }] },
			outputFiles: ['output.mp4'],
			ffmpegCommands: ['-i {{input}} -t 2 {{output.mp4}}'],
			machine: 'cpu',
			wait: true,
		});
		expect(job.status).toBe('succeeded');
		expect(job.output_files).toHaveProperty('output.mp4');
	});
});