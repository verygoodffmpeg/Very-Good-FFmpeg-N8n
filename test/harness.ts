/* eslint-disable -- dev-only file, excluded from the published package */
/**
 * Minimal IExecuteFunctions harness for driving Vgf.node execute() in e2e tests.
 */
import type {
	IBinaryData,
	ICredentialDataDecryptedObject,
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';

/**
 * Parameter map for a single simulated node execution.
 */
export type ParamMap = Record<string, unknown>;

/**
 * Debug logger enabled via VGF_DEBUG, mirroring the SDK test helpers.
 */
export function debug(...args: unknown[]): void {
	if (process.env.VGF_DEBUG) {
		console.log('[vgf:debug]', ...args);
	}
}

/**
 * Reads VGF credentials from the environment, failing fast when absent.
 */
export function credentialsFromEnv(): ICredentialDataDecryptedObject {
	const apiKey = process.env.VGF_API_KEY;
	if (!apiKey) throw new Error('VGF_API_KEY env var is required (see test/.env.test.example)');
	return { apiKey, baseUrl: process.env.VGF_HOST ?? '' };
}

/**
 * Builds an IExecuteFunctions stub backed by a parameter map and optional binary items.
 */
export function makeExecuteContext(options: {
	params: ParamMap;
	items?: INodeExecutionData[];
	binaryBuffers?: Record<string, Buffer>;
}): IExecuteFunctions {
	const items = options.items ?? [{ json: {} }];
	const binaryBuffers = options.binaryBuffers ?? {};

	const ctx = {
		getInputData: () => items,
		getCredentials: async () => credentialsFromEnv(),
		getNodeParameter: (name: string, _itemIndex: number, fallback?: unknown) =>
			name in options.params ? options.params[name] : fallback,
		getNode: () => ({
			id: 'test-node',
			name: 'Very Good FFmpeg',
			type: 'n8n-nodes-verygoodffmpeg.vgf',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		continueOnFail: () => false,
		helpers: {
			assertBinaryData: (itemIndex: number, propertyName: string): IBinaryData => {
				const binary = items[itemIndex]?.binary?.[propertyName];
				if (!binary) throw new Error(`No binary data property "${propertyName}" on item ${itemIndex}`);
				return binary;
			},
			getBinaryDataBuffer: async (_itemIndex: number, propertyName: string): Promise<Buffer> => {
				const buffer = binaryBuffers[propertyName];
				if (!buffer) throw new Error(`No buffer registered for binary property "${propertyName}"`);
				return buffer;
			},
		},
	};

	return ctx as unknown as IExecuteFunctions;
}

/**
 * Polls a job via the node's Get operation until it reaches a terminal status.
 */
export async function pollUntilTerminal(
	execute: (params: ParamMap) => Promise<Record<string, unknown>>,
	jobId: string,
	timeoutMs = 180_000,
): Promise<Record<string, unknown>> {
	const start = Date.now();
	const terminal = new Set(['succeeded', 'failed', 'cancelled']);

	while (Date.now() - start < timeoutMs) {
		const job = await execute({ resource: 'job', operation: 'get', jobId });
		debug(`job ${jobId} status=${job.status as string}`);
		if (terminal.has(job.status as string)) return job;
		await new Promise((resolve) => setTimeout(resolve, 3_000));
	}

	throw new Error(`Timeout waiting for job ${jobId} to reach terminal status`);
}