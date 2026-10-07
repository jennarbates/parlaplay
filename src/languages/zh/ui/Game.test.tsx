import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";
import { useAccountStore } from "../store/account.ts";
import { useGameStore } from "../store/gameStore.ts";
import { Game } from "./Game.tsx";

// Spec 8.2: while the saved round loads, the game shows a skeleton board in the
// board's shape, so nothing jumps when it arrives.
test("loading shows a 24-card skeleton board", () => {
  useGameStore.setState({ status: "loading", game: null });
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/play"]}>
      <Game />
    </MemoryRouter>,
  );
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('aria-label="Loading"');
  expect(html.match(/animate-pulse/g)).toHaveLength(24);
  expect(html).not.toContain('aria-label="Board"');
});

test("a round waits until the account is settled", () => {
  useGameStore.setState({ status: "ready", game: null });
  useAccountStore.setState({ settled: false });
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/play"]}>
      <Game />
    </MemoryRouter>,
  );
  expect(html).toContain('aria-label="Loading"');
});
