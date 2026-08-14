import type {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

// eslint-disable-next-line @n8n/community-nodes/webhook-lifecycle-complete -- VGF webhooks are configured per-job via the Run operation, not registered globally
export class VgfTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Very Good FFmpeg Trigger',
		name: 'vgfTrigger',
		icon: 'file:vgf.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '=Webhook: {{$parameter["path"] || "vgf"}}',
		description: 'Receive job completion callbacks from the Very Good FFmpeg API',
		defaults: { name: 'Very Good FFmpeg Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'vgf',
			},
		],
		properties: [
			{
				displayName:
					'Copy the production webhook URL above into the <b>Webhook URL</b> field of a Very Good FFmpeg node (Job → Run). When the job finishes, VGF will POST the job object to this trigger.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();
		return {
			workflowData: [[{ json: body as IDataObject }]],
		};
	}
}
