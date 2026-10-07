// Spec 3.6: feedback from the engine is a message key plus params, rendered with
// messages.json. Chinese is never italicised: runs of characters come out as their
// own segments, which the UI wraps in lang="zh-Hans" at the normal weight.
import type { Messages } from "../content/schemas.ts";

export type Segment = { text: string; zh: boolean };

const chinese = /([\p{Script=Han}，。？！：、]+)/u;

export function renderMessage(
  messages: Messages,
  key: string,
  params: Record<string, string>,
): Segment[] {
  const template = messages[key];
  if (template === undefined) return [{ text: key, zh: false }];
  const filled = template.replace(/\{(\w+)\}/g, (whole, name: string) => params[name] ?? whole);
  return splitChinese(filled);
}

export function splitChinese(text: string): Segment[] {
  return text
    .split(chinese)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, zh: chinese.test(part) }));
}
