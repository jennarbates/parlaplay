import { useNavigate } from "react-router";
import type { LanguageCode } from "../languages.ts";
import { registry } from "../registry.ts";

// Platform spec 8.1: the language switch on Progress, one segmented button per
// language in registry order, the current one pressed. Switching is a plain
// navigation to /{other}/progress, so it does not change the last language (4.3).
export function LanguageSwitch({ current }: { current: LanguageCode }) {
  const navigate = useNavigate();
  return (
    <div
      role="group"
      aria-label="Language"
      className="grid auto-cols-fr grid-flow-col rounded-xl bg-white p-1 ring-1 ring-stone-200 lg:inline-grid lg:self-start"
    >
      {registry.map(({ code, englishName }) => (
        <button
          key={code}
          type="button"
          aria-pressed={code === current}
          onClick={() => {
            if (code !== current) void navigate(`/${code}/progress`);
          }}
          className={`min-h-11 rounded-lg px-5 font-medium ${
            code === current ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          {englishName}
        </button>
      ))}
    </div>
  );
}
