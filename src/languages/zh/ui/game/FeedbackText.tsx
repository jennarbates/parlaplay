import { content } from "../../content/index.ts";
import type { Feedback } from "../../engine/index.ts";
import { renderMessage } from "../messages.ts";

// Engine feedback rendered with messages.json. Chinese is marked as Chinese and
// never italicised (spec 3.6).
export function FeedbackText({
  feedback,
  tone = "warn",
}: {
  feedback: Feedback | undefined;
  tone?: "warn" | "info" | "muted";
}) {
  if (!feedback?.length) return null;
  const tones = {
    warn: "bg-amber-50 text-amber-950 ring-1 ring-amber-200",
    info: "bg-sky-50 text-sky-950 ring-1 ring-sky-200",
    muted: "text-stone-600",
  };
  return (
    // The status role goes on a wrapper: on the list itself it would replace the
    // list role, and its items would belong to nothing.
    <div role="status" className={`rounded-lg px-3 py-2 text-sm ${tones[tone]}`}>
      <ul className="flex flex-col gap-1">
        {feedback.map((f, i) => (
          <li key={i}>
            {renderMessage(content.messages, f.messageKey, f.params).map((s, j) =>
              s.zh ? (
                <span key={j} lang="zh-Hans">
                  {s.text}
                </span>
              ) : (
                <span key={j}>{s.text}</span>
              ),
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
