import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { VGF, VGFError } from './vendor/sdk';
import type { RunParams } from './vendor/sdk';

type InputFileEntry = { key: string; url: string };

export class Vgf implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Very Good FFmpeg',
		name: 'vgf',
		icon: { light: 'file:vgf.svg', dark: 'file:vgf.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Run FFmpeg jobs on the Very Good FFmpeg API',
		defaults: { name: 'Very Good FFmpeg' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'vgfApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'File', value: 'file' },
					{ name: 'Job', value: 'job' },
				],
				default: 'job',
			},

			// Job operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['job'] } },
				options: [
					{
						name: 'Cancel',
						value: 'cancel',
						action: 'Cancel a job',
						description: 'Cancel a queued or running job',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a job',
						description: 'Retrieve a job by ID',
					},
					{
						name: 'List',
						value: 'list',
						action: 'List jobs',
						description: 'List recent jobs',
					},
					{
						name: 'Run',
						value: 'run',
						action: 'Run an ffmpeg job',
						description: 'Submit an ffmpeg job for processing',
					},
				],
				default: 'run',
			},

			// File operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['file'] } },
				options: [
					{
						name: 'Upload',
						value: 'upload',
						action: 'Upload a file',
						description: 'Upload binary data to VGF temporary storage and get a download URL',
					},
				],
				default: 'upload',
			},

			// --- Job: Run params ---
			{
				displayName: 'Input Files',
				name: 'inputFiles',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Input File',
				default: {},
				displayOptions: { show: { resource: ['job'], operation: ['run'] } },
				description:
					'Named inputs referenced by ffmpeg commands. The key is the placeholder name (e.g. "input1"); the value is a publicly readable URL.',
				options: [
					{
						name: 'file',
						displayName: 'File',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
								placeholder: 'input1',
								description: 'Placeholder name referenced in the ffmpeg command',
							},
							{
								displayName: 'URL',
								name: 'url',
								type: 'string',
								default: '',
								placeholder: 'https://...',
								description: 'Publicly accessible download URL for the input file',
							},
						],
					},
				],
			},
			{
				displayName: 'Output Files',
				name: 'outputFiles',
				type: 'string',
				typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Output' },
				default: [],
				placeholder: 'output1.mp4',
				displayOptions: { show: { resource: ['job'], operation: ['run'] } },
				description: 'Names of output files produced by the ffmpeg commands',
			},
			{
				displayName: 'FFmpeg Commands',
				name: 'ffmpegCommands',
				type: 'string',
				typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Command', rows: 2 },
				default: [],
				placeholder: '-i {{input1}} -c:v libx264 {{output1}}',
				displayOptions: { show: { resource: ['job'], operation: ['run'] } },
				description:
					'FFmpeg command-line invocations to run in order. Reference inputs/outputs by their placeholder names.',
			},
			{
				displayName: 'Machine',
				name: 'machine',
				type: 'options',
				options: [
					{ name: 'CPU', value: 'cpu' },
					{ name: 'NVIDIA GPU', value: 'nvidia' },
				],
				default: 'cpu',
				displayOptions: { show: { resource: ['job'], operation: ['run'] } },
				description: 'Machine type to run the job on',
			},
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['job'], operation: ['run'] } },
				description:
					'Optional URL the API will POST the completed job to. Pair with the Very Good FFmpeg Trigger node for async workflows.',
			},
			{
				displayName: 'Wait for Completion',
				name: 'wait',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['job'], operation: ['run'] } },
				description:
					'Whether to block until the job finishes. Long-running jobs may exceed n8n execution timeouts; prefer the Trigger node for async.',
			},

			// --- Job: Get / Cancel ---
			{
				displayName: 'Job ID',
				name: 'jobId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['job'], operation: ['get', 'cancel'] } },
				description: 'The job identifier',
			},

			// --- Job: List ---
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 50,
				displayOptions: { show: { resource: ['job'], operation: ['list'] } },
				description: 'Max number of results to return',
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				displayOptions: { show: { resource: ['job'], operation: ['list'] } },
				description: 'Pagination offset',
			},

			// --- File: Upload ---
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
				description: 'Name of the binary property on the input item containing the file to upload',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const creds = await this.getCredentials('vgfApi');
		const client = new VGF(creds.apiKey as string, {
			baseUrl: (creds.baseUrl as string) || undefined,
		});

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				let result: unknown;

				if (resource === 'job' && operation === 'run') {
					const inputFilesCollection = this.getNodeParameter('inputFiles', i, {}) as {
						file?: InputFileEntry[];
					};
					const input_files: Record<string, string> = {};
					for (const entry of inputFilesCollection.file ?? []) {
						if (entry.key) input_files[entry.key] = entry.url;
					}

					const params: RunParams = {
						input_files,
						output_files: this.getNodeParameter('outputFiles', i, []) as string[],
						ffmpeg_commands: this.getNodeParameter('ffmpegCommands', i, []) as string[],
						machine: this.getNodeParameter('machine', i, 'cpu') as 'cpu' | 'nvidia',
					};
					const webhookUrl = this.getNodeParameter('webhookUrl', i, '') as string;
					if (webhookUrl) params.webhook_url = webhookUrl;

					const wait = this.getNodeParameter('wait', i, false) as boolean;
					result = await client.run(params, { wait });
				} else if (resource === 'job' && operation === 'get') {
					const id = this.getNodeParameter('jobId', i) as string;
					result = await client.jobs.get(id);
				} else if (resource === 'job' && operation === 'cancel') {
					const id = this.getNodeParameter('jobId', i) as string;
					result = await client.jobs.cancel(id);
				} else if (resource === 'job' && operation === 'list') {
					const limit = this.getNodeParameter('limit', i, 25) as number;
					const offset = this.getNodeParameter('offset', i, 0) as number;
					const res = await client.jobs.list({ limit, offset });
					for (const job of res.data) {
						returnData.push({ json: job as unknown as IDataObject, pairedItem: i });
					}
					continue;
				} else if (resource === 'file' && operation === 'upload') {
					const binaryProp = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
					const binary = this.helpers.assertBinaryData(i, binaryProp);
					const buffer = await this.helpers.getBinaryDataBuffer(i, binaryProp);
					const downloadUrl = await client.files.upload(buffer, binary.mimeType);
					result = { download_url: downloadUrl };
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported ${resource}.${operation}`,
						{ itemIndex: i },
					);
				}

				returnData.push({
					json: result as IDataObject,
					pairedItem: i,
				});
			} catch (error) {
				if (error instanceof VGFError) {
					const apiError = new NodeApiError(this.getNode(), { message: error.message } as never, {
						httpCode: String(error.status),
						message: error.message,
					});
					if (this.continueOnFail()) {
						returnData.push({ json: { error: apiError.message }, pairedItem: i });
						continue;
					}
					throw apiError;
				}
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: i,
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
