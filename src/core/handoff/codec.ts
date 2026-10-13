// Platform spec 5.3: the handoff as /import reads it, checked with Zod.
import { decodeJson, encodeJson, maxEncodedLength } from "./encoding.ts";
import { Handoff } from "./schema.ts";

export { maxEncodedLength };

export const encodeHandoff = (handoff: Handoff): Promise<string> => encodeJson(handoff);

// Throws on anything that is not a valid handoff: bad base64url, bad gzip, bad
// JSON, or data Zod rejects. Nothing from it is used before it has all passed.
export async function decodeHandoff(data: string): Promise<Handoff> {
  return Handoff.parse(await decodeJson(data));
}
