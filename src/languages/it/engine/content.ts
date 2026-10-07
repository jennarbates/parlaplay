// Lookups over the content the engine is given, built once per content object.
import type { Adjective, Article, Character, Noun, Template, Verb } from "../content/schemas.ts";
import type { EngineContent } from "./types.ts";

export type Index = {
  article: Map<string, Article>;
  verb: Map<string, Verb>;
  noun: Map<string, Noun>;
  adj: Map<string, Adjective>;
  template: Map<string, Template>;
  character: Map<string, Character>;
  characterIds: string[];
};

const cache = new WeakMap<EngineContent, Index>();

export function indexContent(content: EngineContent): Index {
  const cached = cache.get(content);
  if (cached) return cached;
  const index: Index = {
    article: new Map(),
    verb: new Map(),
    noun: new Map(),
    adj: new Map(),
    template: new Map(content.templates.map((t) => [t.id, t])),
    character: new Map(content.characters.map((c) => [c.id, c])),
    characterIds: content.characters.map((c) => c.id),
  };
  for (const e of content.lexicon) {
    if (e.pos === "article") index.article.set(e.id, e);
    else if (e.pos === "verb") index.verb.set(e.id, e);
    else if (e.pos === "noun") index.noun.set(e.id, e);
    else index.adj.set(e.id, e);
  }
  cache.set(content, index);
  return index;
}

export type FormKey = keyof Adjective["forms"];
const formKeys: readonly string[] = ["ms", "fs", "mp", "fp"];

// "adj.biondo#mp" → { lemmaId: "adj.biondo", formKey: "mp" }
export function parseAdjRef(ref: string): { lemmaId: string; formKey: FormKey } | undefined {
  const [lemmaId, formKey, ...rest] = ref.split("#");
  if (!lemmaId || !formKey || rest.length || !formKeys.includes(formKey)) return undefined;
  return { lemmaId, formKey: formKey as FormKey };
}

// The form an adjective takes with a noun: m + pl → mp.
export function formKeyFor(noun: Noun): FormKey {
  return `${noun.gender}${noun.number === "sg" ? "s" : "p"}` as FormKey;
}
