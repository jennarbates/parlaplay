// Platform spec 3.2, 9 and D17: each language's module is loaded with import() the
// first time one of its routes is visited, and its routes are added to the router
// then. The picker and one language never load another language.
import type { RouteObject } from "react-router";
import type { LanguageModule } from "./language-module.ts";
import type { LanguageCode } from "./languages.ts";
import { codeOf } from "./registry.ts";

const loaders = import.meta.glob<LanguageModule>("../languages/*/index.ts", {
  import: "default",
});

const loading = new Map<LanguageCode, Promise<LanguageModule>>();

export function loadModule(code: LanguageCode): Promise<LanguageModule> {
  const cached = loading.get(code);
  if (cached) return cached;
  const loader = loaders[`../languages/${code}/index.ts`];
  if (!loader) return Promise.reject(new Error(`No module for language "${code}"`));
  const promise = loader().catch((error: unknown) => {
    loading.delete(code); // offline on first visit: Try again loads it afresh
    throw error;
  });
  loading.set(code, promise);
  return promise;
}

export type PatchArgs = {
  path: string;
  patch: (routeId: string | null, children: RouteObject[]) => void;
};

type Options = {
  parentId: string; // the shell route the languages hang under
  load?: (code: LanguageCode) => Promise<LanguageModule>;
  notFound: RouteObject; // a path inside a language that it does not have
  failed: (code: LanguageCode) => RouteObject; // the module could not be loaded (8.2)
};

// For createBrowserRouter's patchRoutesOnNavigation. A language's routes are added
// once; paths outside every language are left to the shell's own routes.
export function patchLanguageRoutes({ parentId, load = loadModule, notFound, failed }: Options) {
  const patched = new Set<LanguageCode>();
  return async ({ path, patch }: PatchArgs): Promise<void> => {
    const code = codeOf(path);
    if (!code || patched.has(code)) return;
    patched.add(code);
    try {
      const module = await load(code);
      patch(parentId, [{ id: `lang-${code}`, path: code, children: [...module.routes, notFound] }]);
    } catch {
      patch(parentId, [{ id: `lang-${code}`, path: code, children: [failed(code)] }]);
    }
  };
}
