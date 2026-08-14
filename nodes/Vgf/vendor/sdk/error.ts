export class VGFError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`VGF API error ${status}: ${body}`);
    this.name = "VGFError";
    this.status = status;
    this.body = body;
  }
}
