/**
 * Bounded Cloud API JSON reader. Do not trust Content-Length:
 * chunked requests can omit it, so count bytes while consuming the stream.
 */
export class CloudRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "CloudRequestError";
  }
}

export async function readCloudJson(request: Request, maxBytes: number): Promise<Record<string, any>> {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new Error("Invalid API size limit.");
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    throw new CloudRequestError("Request body exceeds the Cloud limit.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new CloudRequestError("JSON request body is required.", 400);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new CloudRequestError("Request body exceeds the Cloud limit.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CloudRequestError("JSON object expected.", 400);
    }
    return parsed as Record<string, any>;
  } catch (error) {
    if (error instanceof CloudRequestError) throw error;
    if (error instanceof SyntaxError || error instanceof TypeError) {
      throw new CloudRequestError("Invalid JSON request.", 400);
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}
