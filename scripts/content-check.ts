// Spec 3: checks every JSON file in a content folder against its schema, for
// every language (platform spec 3.1). The Vite plugin below runs it, so
// `pnpm build` fails and `pnpm dev` shows an error overlay on bad content.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import type { ZodType } from "zod";
import { RegistryFile, type LanguageCode } from "../src/core/languages.ts";
import { contentFiles as itFiles } from "../src/languages/it/content/schemas.ts";
import { contentFiles as zhFiles } from "../src/languages/zh/content/schemas.ts";

// One schema per file name, from the language's content/schemas.ts.
export type Schemas = Record<string, ZodType>;
export type LanguageContent = { code: LanguageCode; dir: string; schemas: Schemas };

const dirOf = (code: LanguageCode) =>
  new URL(`../src/languages/${code}/content/`, import.meta.url).pathname;

// Every language's content folder. A test checks the codes match the registry.
export const languageContent: LanguageContent[] = [
  { code: "it", dir: dirOf("it"), schemas: itFiles },
  { code: "zh", dir: dirOf("zh"), schemas: zhFiles },
];

export function validateContentDir(
  dir: string,
  contentFiles: Schemas,
  { requireAll = true } = {},
): string[] {
  const problems: string[] = [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  if (requireAll) {
    for (const file of Object.keys(contentFiles)) {
      if (!files.includes(file)) problems.push(`${file}: missing`);
    }
  }

  for (const file of files) {
    const schema = contentFiles[file];
    if (!schema) {
      problems.push(`${file}: no schema for this file; add one to contentFiles in schemas.ts`);
      continue;
    }
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (error) {
      problems.push(`${file}: not valid JSON (${(error as Error).message})`);
      continue;
    }
    const result = schema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        problems.push(`${file}: ${formatPath(issue.path)}${issue.message}`);
      }
    }
  }
  return problems;
}

function formatPath(path: PropertyKey[]): string {
  return path.length ? `${path.map(String).join(".")}: ` : "";
}

// Spec 3.1: the language registry is checked like content.
export function validateRegistryFile(file: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return [`languages.json: not valid JSON (${(error as Error).message})`];
  }
  const result = RegistryFile.safeParse(data);
  if (result.success) return [];
  return result.error.issues.map(
    (issue) => `languages.json: ${formatPath(issue.path)}${issue.message}`,
  );
}

export const registryFile = new URL("../src/core/languages.json", import.meta.url).pathname;

export function contentCheck(
  languages = languageContent,
  options?: { requireAll?: boolean },
  registry = registryFile,
): Plugin {
  const check = () => {
    const problems = [
      ...languages.flatMap(({ code, dir, schemas }) =>
        validateContentDir(dir, schemas, options).map((p) => `${code}/${p}`),
      ),
      ...validateRegistryFile(registry),
    ];
    if (problems.length) throw new Error(`Invalid content:\n  ${problems.join("\n  ")}`);
  };
  return {
    name: "content-check",
    buildStart: check,
    handleHotUpdate({ file }) {
      const inContent = languages.some(({ dir }) => file.startsWith(dir));
      if ((inContent && file.endsWith(".json")) || file === registry) check();
    },
  };
}
