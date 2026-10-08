import { content } from "../../content/index.ts";
import type { Feedback } from "../../engine/index.ts";
import { renderMessage } from "../messages.ts";

// Engine feedback rendered with messages.json, Italian in italics (spec 3.7).
export function FeedbackText({
  feedback,
  tone = "warn",
}: {
  feedback: Feedback | undefined;
  tone?: "warn" | "info";
}) {
  if (!feedback?.length) return null;
  return (
    <ul
      role="status"
      className={`flex flex-col gap-1 rounded-lg px-3 py-2 text-sm ${
        tone === "warn"
          ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200"
          : "bg-sky-50 text-sky-950 ring-1 ring-sky-200"
      }`}
    >
      {feedback.map((f, i) => (
        <li key={i}>
          {renderMessage(content.messages, f.messageKey, f.params).map((s, j) =>
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
  );
}
