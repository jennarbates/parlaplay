import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { layersFor } from "../content/art.ts";
import { content } from "../content/index.ts";
import { Face } from "./Face.tsx";

const srcs = (html: string) => [...html.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => m[1]);

test.each(content.characters.map((c) => [c.name, c] as const))(
  "%s renders its layers in order",
  (_, c) => {
    const html = renderToStaticMarkup(<Face character={c} />);
    expect(srcs(html)).toEqual(layersFor(c).map((f) => `/art/it/${f}`));
  },
);

test("layers are decorative; the label goes on the face", () => {
  const giulia = content.characters.find((c) => c.id === "c.giulia");
  if (!giulia) throw new Error("c.giulia missing");
  const labelled = renderToStaticMarkup(<Face character={giulia} label="Giulia" />);
  expect(labelled).toContain('role="img"');
  expect(labelled).toContain('aria-label="Giulia"');
  expect(labelled.match(/alt=""/g)).toHaveLength(layersFor(giulia).length);

  const hidden = renderToStaticMarkup(<Face character={giulia} />);
  expect(hidden).toContain('aria-hidden="true"');
  expect(hidden).not.toContain("role=");
});
