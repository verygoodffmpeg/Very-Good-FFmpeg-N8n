import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class VgfApi implements ICredentialType {
	name = 'vgfApi';

	displayName = 'Very Good FFmpeg API';

	icon: Icon = 'file:../nodes/Vgf/vgf.svg';

	documentationUrl = 'https://verygoodffmpeg.com/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key issued by verygoodffmpeg.com',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://verygoodffmpeg.com/api',
			description: 'Override the API base URL (advanced)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials?.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.baseUrl}}',
			url: '/jobs',
			method: 'GET',
			qs: { limit: 1 },
		},
	};
}
