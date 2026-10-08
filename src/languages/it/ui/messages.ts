// Spec 3.7: feedback from the engine is a message key plus params, rendered with
// messages.json. *Italian words* come out as italic segments.
import type { Messages } from "../content/schemas.ts";

export type Segment = { text: string; italic: boolean };

export function renderMessage(
  messages: Messages,
  key: string,
  params: Record<string, string>,
): Segment[] {
  const template = messages[key];
  if (template === undefined) return [{ text: key, italic: false }];
  const filled = template.replace(/\{(\w+)\}/g, (whole, name: string) => params[name] ?? whole);
  return filled
    .split(/(\*[^*]+\*)/)
    .filter((part) => part !== "")
    .map((part) =>
      part.startsWith("*") && part.endsWith("*") && part.length > 2
        ? { text: part.slice(1, -1), italic: true }
        : { text: part, italic: false },
    );
}
