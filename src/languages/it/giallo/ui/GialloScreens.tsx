// Chi è stato? GS 9.1: the giallo's routes, loaded as their own chunk so Chi è?'s
// players never pay for its content. PLAY-091 builds these screens out.
import { Link } from "react-router";
import { content } from "../content/index.ts";
import { paths } from "../../paths.ts";

// Its own text rather than core/games.ts: importing that from this chunk makes the
// build split the shell, which grows every page (platform spec 9).
const title = "Chi è stato?";

export function CaseList() {
  return (
    <section className="flex flex-col gap-4 p-4 lg:p-10">
      <h1 lang="it" className="text-4xl font-bold">
        {title}
      </h1>
      <ul className="flex flex-col gap-2">
        {content.cases.map((c) => (
          <li key={c.id} lang="it" className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
            {c.title}
          </li>
        ))}
      </ul>
      <Link to={paths.home} className="inline-flex min-h-11 items-center underline">
        Back to Italian
      </Link>
    </section>
  );
}

export function CaseScreen() {
  return (
    <section className="flex flex-col gap-4 p-4 lg:p-10">
      <h1 lang="it" className="text-4xl font-bold">
        {title}
      </h1>
      <p className="text-stone-600">Coming soon.</p>
      <Link to={paths.giallo} className="inline-flex min-h-11 items-center underline">
        Back to cases
      </Link>
    </section>
  );
}
