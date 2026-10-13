// Platform spec 5.3 and D22: the handoff travels in the URL fragment as JSON,
// gzipped with the browser's own CompressionStream, then base64url-encoded. No
// imports, so the handoff page (handoff/) can use it without the rest of the app.

// The handoff page refuses to navigate above this many encoded characters (D22).
export const maxEncodedLength = 900_000;
// A fragment that expands past this is not a handoff. The largest real one is a
// few hundred KB of JSON.
const maxJsonBytes = 16 * 1024 * 1024;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url");
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  through: CompressionStream | DecompressionStream,
  limit = Infinity,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = new Blob([bytes]).stream().pipeThrough(through).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error("handoff too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

export async function encodeJson(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  return toBase64Url(await pipe(json, new CompressionStream("gzip")));
}

// Throws on bad base64url, bad gzip or bad JSON. What comes back is unchecked.
export async function decodeJson(data: string): Promise<unknown> {
  if (data.length > maxEncodedLength) throw new Error("handoff too large");
  const json = await pipe(fromBase64Url(data), new DecompressionStream("gzip"), maxJsonBytes);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(json));
}
