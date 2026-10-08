// Platform spec 3.2, 8.2 and D17: a language's routes arrive with its module, the
// first time one of them is visited.
import { createMemoryRouter, type RouteObject } from "react-router";
import { describe, expect, test } from "vitest";
import type { LanguageModule } from "./language-module.ts";
import type { LanguageCode } from "./languages.ts";
import { patchLanguageRoutes } from "./modules.ts";

const fakeModule = (code: LanguageCode): LanguageModule => ({
  code,
  contentVersion: 1,
  routes: [
    { index: true, handle: { page: `${code} home` } },
    { path: "play", handle: { page: `${code} play` } },
    { path: "progress", handle: { page: `${code} progress` } },
  ],
  cardIds: () => [],
  labelFor: () => undefined,
  isResumable: () => false,
  deviceSettings: { parse: (v: unknown) => v } as LanguageModule["deviceSettings"],
});

function setup(load: (code: LanguageCode) => Promise<LanguageModule>) {
  const loads: LanguageCode[] = [];
  const routes: RouteObject[] = [
    {
      id: "shell",
      children: [
        { index: true, handle: { page: "root" } },
        { path: "languages", handle: { page: "picker" } },
        { path: "*", handle: { page: "not found" } },
      ],
    },
  ];
  const patchRoutesOnNavigation = patchLanguageRoutes({
    parentId: "shell",
    load: (code) => {
      loads.push(code);
      return load(code);
    },
    notFound: { path: "*", handle: { page: "language not found" } },
    failed: (code) => ({ path: "*", handle: { page: `${code} failed` } }),
  });
  const router = createMemoryRouter(routes, { patchRoutesOnNavigation });
  const page = () => (router.state.matches.at(-1)?.route.handle as { page: string }).page;
  return { router, page, loads };
}

describe("patchLanguageRoutes", () => {
  test("a language's routes load on its first visit, once", async () => {
    const { router, page, loads } = setup(async (code) => fakeModule(code));
    await router.navigate("/languages");
    expect(page()).toBe("picker");
    expect(loads).toEqual([]);
    await router.navigate("/zh/play");
    expect(page()).toBe("zh play");
    await router.navigate("/zh");
    expect(page()).toBe("zh home");
    await router.navigate("/zh/progress");
    expect(page()).toBe("zh progress");
    expect(loads).toEqual(["zh"]);
  });

  test("visiting one language never loads another", async () => {
    const { router, loads } = setup(async (code) => fakeModule(code));
    await router.navigate("/it/play");
    expect(loads).toEqual(["it"]);
  });

  test("an unknown path inside a language is not found; an unknown language loads nothing", async () => {
    const { router, page, loads } = setup(async (code) => fakeModule(code));
    await router.navigate("/it/nope");
    expect(page()).toBe("language not found");
    await router.navigate("/fr/play");
    expect(page()).toBe("not found");
    expect(loads).toEqual(["it"]);
  });

  test("a module that fails to load shows the failure screen (8.2)", async () => {
    const { router, page } = setup(async () => {
      throw new Error("offline");
    });
    await router.navigate("/zh/play");
    expect(page()).toBe("zh failed");
  });
});
