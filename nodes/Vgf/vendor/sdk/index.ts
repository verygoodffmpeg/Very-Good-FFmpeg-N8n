import type {
  Job,
  RunParams,
  RunOptions,
  ListJobsParams,
  PagingParams,
  TmpFile,
} from "./types";

export type {
  Job,
  RunParams,
  RunOptions,
  ListJobsParams,
  PagingParams,
  TmpFile,
};
export { VGFError } from "./error";

const BASE_URL = "https://verygoodffmpeg.com/api";

export class VGF {
  readonly jobs: Jobs;
  readonly files: Files;

  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, options?: { baseUrl?: string }) {
    if (!apiKey) throw new Error("API key is required");
    this.apiKey = apiKey;
    this.baseUrl = options?.baseUrl ?? BASE_URL;
    this.jobs = new Jobs(this);
    this.files = new Files(this);
  }

  async run(params: RunParams, options: RunOptions = {}): Promise<Job> {
    const qs = options.wait ? "?wait=true" : "";
    const body = {
      input_files: params.input_files,
      output_files: params.output_files,
      ffmpeg_commands: params.ffmpeg_commands,
      webhook_url: params.webhook_url,
      machine: params.machine,
    };
    const res = await this._request<{ data: Job }>(
      "POST",
      `/ffmpeg${qs}`,
      body,
    );
    return res.data;
  }

  /** @internal */
  async _request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        // "Content-Type": "application/json",
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const { VGFError } = await import("./error.js");
      throw new VGFError(res.status, text);
    }

    return res.json() as Promise<T>;
  }
}

class Jobs {
  constructor(private client: VGF) {}

  async list(
    params: ListJobsParams = {},
  ): Promise<{ data: Job[]; pagingParams: PagingParams }> {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const query = qs.size ? `?${qs}` : "";
    return this.client._request("GET", `/jobs${query}`);
  }

  async get(id: string): Promise<Job> {
    const res = await this.client._request<{ data: Job }>(
      "GET",
      `/jobs/${encodeURIComponent(id)}`,
    );
    return res.data;
  }

  async cancel(id: string): Promise<Job> {
    const res = await this.client._request<{ data: Job }>(
      "POST",
      `/jobs/${encodeURIComponent(id)}/cancel`,
    );
    return res.data;
  }
}

class Files {
  constructor(private client: VGF) {}

  async prepareUpload(): Promise<TmpFile> {
    const res = await this.client._request<{ data: TmpFile }>(
      "POST",
      "/tmp-file",
    );
    return res.data;
  }

  /**
   * Uploads a file to temporary storage and returns the download URL,
   * which can be used as an input_files value in a job.
   */
  async upload(
    data: Buffer | Blob | ReadableStream | Uint8Array,
    contentType = "application/octet-stream",
  ): Promise<string> {
    const { upload_url, download_url } = await this.prepareUpload();
    const res = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: data as any,
    });
    if (!res.ok) {
      const { VGFError } = await import("./error.js");
      throw new VGFError(res.status, `File upload failed: ${res.statusText}`);
    }
    return download_url;
  }
}

export default VGF;
