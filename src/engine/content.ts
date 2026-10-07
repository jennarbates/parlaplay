// Lookups over the content the engine is given, built once per content object.
import type { Answer, Character, LexiconEntry, Noun, Pronoun, Verb } from "../content/schemas.ts";
import type { EngineContent } from "./types.ts";

export type Index = {
  entry: Map<string, LexiconEntry>;
  noun: Map<string, Noun>;
  verb: Map<string, Verb>;
  pronoun: Map<string, Pronoun>;
  answer: Map<string, Answer>;
  character: Map<string, Character>;
  characterIds: string[];
};

const cache = new WeakMap<EngineContent, Index>();

export function indexContent(content: EngineContent): Index {
  const cached = cache.get(content);
  if (cached) return cached;
  const index: Index = {
    entry: new Map(content.lexicon.map((e) => [e.id, e])),
    noun: new Map(),
    verb: new Map(),
    pronoun: new Map(),
    answer: new Map(),
    character: new Map(content.characters.map((c) => [c.id, c])),
    characterIds: content.characters.map((c) => c.id),
  };
  for (const e of content.lexicon) {
    if (e.pos === "noun") index.noun.set(e.id, e);
    else if (e.pos === "verb") index.verb.set(e.id, e);
    else if (e.pos === "pronoun") index.pronoun.set(e.id, e);
    else if (e.pos === "answer") index.answer.set(e.id, e);
  }
  cache.set(content, index);
  return index;
}

export function need<T>(map: Map<string, T>, id: string): T {
  const found = map.get(id);
  if (found === undefined) throw new Error(`Unknown id ${id}`);
  return found;
}

export const ma = "pt.ma";
export const he = "pr.ta.m";
export const she = "pr.ta.f";
