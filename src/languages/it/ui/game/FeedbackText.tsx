import { content } from "../../content/index.ts";
import type { Messages } from "../../content/schemas.ts";
import type { Feedback } from "../../engine/index.ts";
import { renderMessage } from "../messages.ts";

// Engine feedback rendered with messages.json, Italian in italics (spec 3.7). The
// giallo passes its own messages (GS 3.2).
export function FeedbackText({
  feedback,
  tone = "warn",
  messages = content.messages,
}: {
  feedback: Feedback | undefined;
  tone?: "warn" | "info";
  messages?: Messages;
}) {
  if (!feedback?.length) return null;
  return (
    // The status role goes on a wrapper: on the list itself it would replace the
    // list role, and its items would belong to nothing.
    <div
      role="status"
      className={`rounded-lg px-3 py-2 text-sm ${
        tone === "warn"
          ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200"
          : "bg-sky-50 text-sky-950 ring-1 ring-sky-200"
      }`}
    >
      <ul className="flex flex-col gap-1">
        {feedback.map((f, i) => (
          <li key={i}>
            {renderMessage(messages, f.messageKey, f.params).map((s, j) =>
              s.italic ? (
                <em key={j} lang="it" className="font-medium">
                  {s.text}
                </em>
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
