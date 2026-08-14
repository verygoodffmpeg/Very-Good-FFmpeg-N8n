export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface Job {
  id: string;
  status: JobStatus;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  error_message: string;
  ffmpeg_commands: string[];
  input_files: Record<string, string>;
  output_files: Record<string, string>;
  webhook_url: string | null;
  total_input_bytes: number | null;
  total_output_bytes: number | null;
}

export interface RunParams {
  input_files: Record<string, string>;
  output_files: string[];
  ffmpeg_commands: string[];
  webhook_url?: string;
  machine?: "cpu" | "nvidia";
}

export interface RunOptions {
  /** Wait for the job to complete before returning. */
  wait?: boolean;
}

export interface ListJobsParams {
  limit?: number;
  offset?: number;
}

export interface PagingParams {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface TmpFile {
  upload_url: string;
  download_url: string;
}
