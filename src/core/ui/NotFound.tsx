import { Link, useLocation } from "react-router";
import { codeOf } from "../registry.ts";

// Platform spec 2 and 8.1: a path whose first segment looks like a language code
// we don't have gets the language message; any other unknown path, "Page not found."
export function NotFound() {
  const { pathname } = useLocation();
  const first = pathname.split("/").find(Boolean) ?? "";
  const unknownLanguage = /^[a-z]{2,3}$/.test(first) && codeOf(pathname) === null;

  return (
    <section className="flex flex-col gap-4 p-4 pt-10 lg:p-10">
      <h1 className="text-2xl font-bold">
        {unknownLanguage ? "We don't have that language yet." : "Page not found."}
      </h1>
      <Link
        to={unknownLanguage ? "/languages" : "/"}
        className="inline-flex min-h-11 items-center self-start text-blue-700 underline"
      >
        {unknownLanguage ? "Choose a language" : "Go home"}
      </Link>
    </section>
  );
}
