import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GialloCard } from "./GialloCard.tsx";

// Server rendering reads a store's initial state, so the saved flag is set here.
const saved = vi.hoisted(() => ({ giallo: false }));
vi.mock("../../../core/store/rounds.ts", () => ({
  useRounds: (select: (r: { saved: typeof saved }) => unknown) => select({ saved }),
}));

const render = (ready?: boolean) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <GialloCard {...(ready !== undefined && { ready })} />
    </MemoryRouter>,
  );

afterEach(() => {
  saved.giallo = false;
});

describe("the giallo's card on Italian Home (GS 9.1)", () => {
  test("today it is coming soon, with no link into the game", () => {
    const html = render();
    expect(html).toContain("Chi è stato?");
    expect(html).toContain("Coming soon");
    expect(html).not.toContain("<a");
  });

  test("once ready, it goes to the case list", () => {
    const html = render(true);
    expect(html).toContain('href="/it/giallo"');
    expect(html).toContain("Solve a case");
    expect(html).not.toContain("Coming soon");
  });

  test("once ready, a saved case offers Continue case", () => {
    saved.giallo = true;
    const html = render(true);
    expect(html).toContain('href="/it/giallo/play"');
    expect(html).toContain("Continue case");
  });
});
