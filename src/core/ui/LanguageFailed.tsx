import type { LanguageCode } from "../languages.ts";
import { languageOf } from "../registry.ts";

// Platform spec 8.2: the language's module could not be loaded (offline on first
// visit). Try again reloads the page, which loads it afresh.
export function LanguageFailed({ code }: { code: LanguageCode }) {
  return (
    <section role="alert" className="flex flex-col gap-4 p-4 pt-10 lg:p-10">
      <p className="text-lg">
        Couldn't load {languageOf(code).englishName}. Check your connection.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-12 self-start rounded-xl bg-stone-900 px-6 font-semibold text-white"
      >
        Try again
      </button>
    </section>
  );
}
