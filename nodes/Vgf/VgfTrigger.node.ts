import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

/**
 * Webhook trigger that receives job completion callbacks from the VGF API.
 */
// eslint-disable-next-line @n8n/community-nodes/node-usable-as-tool -- trigger nodes must not be usable as tools; newer rule versions forbid the property here
export class VgfTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Very Good FFmpeg Trigger',
		name: 'vgfTrigger',
		icon: { light: 'file:vgf.svg', dark: 'file:vgf.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '=Webhook: {{$parameter["path"] || "vgf"}}',
		description: 'Receive job completion callbacks from the Very Good FFmpeg API',
		defaults: { name: 'Very Good FFmpeg Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
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

	// The VGF API has no server-side webhook registry: the callback URL is
	// passed per-job in the Run operation, so there is nothing to register,
	// verify, or remove on the service.
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();
		return {
			workflowData: [[{ json: body as IDataObject }]],
		};
	}
}
