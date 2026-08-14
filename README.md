# @verygoodffmpeg/n8n-nodes-verygoodffmpeg

Run [FFmpeg](https://ffmpeg.org) jobs in the cloud from your [n8n](https://n8n.io) workflows, powered by the [Very Good FFmpeg](https://verygoodffmpeg.com) API. Transcode, trim, resize, and convert video/audio without hosting FFmpeg yourself — on CPU or NVIDIA GPU machines.

## Installation

**n8n Cloud / verified:** search for "Very Good FFmpeg" in the nodes panel and install from there.

**Self-hosted:** **Settings → Community Nodes → Install** and enter `@verygoodffmpeg/n8n-nodes-verygoodffmpeg`.

## Credentials

1. Create an account and API key at [verygoodffmpeg.com](https://verygoodffmpeg.com).
2. In n8n, add a **Very Good FFmpeg API** credential and paste the key. Leave *Base URL* empty.

## Operations

### Very Good FFmpeg

| Resource | Operation | What it does |
|---|---|---|
| Job | Run | Submit an FFmpeg job: named input URLs, output filenames, and FFmpeg command lines |
| Job | Get | Fetch a job by ID (status, output file URLs) |
| Job | List | List recent jobs with limit/offset paging |
| Job | Cancel | Cancel a queued or running job |
| File | Upload | Upload binary data from the workflow and get back a URL usable as a job input |

### Very Good FFmpeg Trigger

A webhook trigger that fires when a job finishes. Copy the trigger's webhook URL into the **Webhook URL** field of a *Job → Run* operation; the completed job object arrives as the trigger output.

## Example: trim a video to 5 seconds

1. Add a **Very Good FFmpeg** node, *Job → Run*:
   - **Input Files**: key `input`, URL `https://storage.verygoodffmpeg.com/sample.mp4` (any public URL works)
   - **Output Files**: `output.mp4`
   - **FFmpeg Commands**: `-i {{input}} -t 5 {{output.mp4}}`
   - **Wait for Completion**: on (fine for short jobs)
2. Execute. The output item contains `status: "succeeded"` and `output_files["output.mp4"]` — a download URL for the result.

Reference inputs and outputs in commands by their placeholder names in double braces. Multiple commands run in order in the same workspace.

## Example: long jobs without blocking

n8n executions time out on long transcodes, so for anything substantial run asynchronously:

1. Add a **Very Good FFmpeg Trigger** to a workflow and copy its production webhook URL.
2. In *Job → Run*, paste that URL into **Webhook URL** and leave **Wait for Completion** off.
3. The run node returns immediately with the queued job; the trigger workflow receives the full job object (including output URLs) when it completes.

## Working with binary data

Files already in your workflow (from HTTP Request, Google Drive, etc.) can be sent through *File → Upload*: it uploads the item's binary property to temporary storage and returns a `download_url` to use as a *Job → Run* input.

## Use with AI Agents and MCP

Both nodes are marked `usableAsTool`. Attach the **Very Good FFmpeg** node to an **AI Agent** node as a tool, or expose it to external MCP clients (Claude, Cursor, etc.) via n8n's **MCP Server Trigger** — each operation surfaces as a callable tool.

## Errors

API failures surface as standard n8n node errors with the HTTP status and the API's message (e.g. `402: Add credit before submitting another job`). Use n8n's *On Error* node settings for retry/continue behavior.

## Development

Contributions welcome — see [DEVELOPMENT.md](https://github.com/verygoodffmpeg/Very-Good-FFmpeg-N8n/blob/master/DEVELOPMENT.md) for local setup and the test suites.

## License

MIT
