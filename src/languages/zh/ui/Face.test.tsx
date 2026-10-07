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
    expect(srcs(html)).toEqual(layersFor(c).map((f) => `/art/zh/${f}`));
  },
);

test("layers are decorative; the label goes on the face", () => {
  const lili = content.characters.find((c) => c.id === "c.lili");
  if (!lili) throw new Error("c.lili missing");
  const labelled = renderToStaticMarkup(<Face character={lili} label="李丽" />);
  expect(labelled).toContain('role="img"');
  expect(labelled).toContain('aria-label="李丽"');
  expect(labelled.match(/alt=""/g)).toHaveLength(layersFor(lili).length);

  const hidden = renderToStaticMarkup(<Face character={lili} />);
  expect(hidden).toContain('aria-hidden="true"');
  expect(hidden).not.toContain("role=");
});
