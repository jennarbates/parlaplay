// Spec 3.4 and 4.1: the Level 2 builder's four slots become an ASK payload, or a
// shape error the UI shows. Shape errors dispatch nothing and log nothing.
import { indexContent } from "./content.ts";
import type { EngineContent, Fill, ShapeError } from "./types.ts";

export type Tiles = { verb?: string; art?: string; noun?: string; adj?: string }; // ids; adj as "adj.biondo#mp"

export type Parsed = { templateId: string; fill: Fill } | { shapeError: ShapeError };

export function parseTiles(tiles: Tiles, content: EngineContent): Parsed {
  if (!tiles.verb) return { shapeError: { kind: "noVerb" } };
  if (!tiles.art) return { shapeError: { kind: "noArt" } };
  if (!tiles.noun) return { shapeError: { kind: "noNoun" } };

  // The noun picks the template.
  const index = indexContent(content);
  const noun = index.noun.get(tiles.noun);
  const template = noun && index.template.get(noun.template);
  if (template?.needsAdj && !tiles.adj) return { shapeError: { kind: "needsAdj" } };
  if (template && !template.needsAdj && tiles.adj) return { shapeError: { kind: "noAdjAllowed" } };

  // An unknown noun gets no template; the ASK step rejects it as unknownId.
  const fill: Fill = {
    verb: tiles.verb,
    art: tiles.art,
    noun: tiles.noun,
    ...(tiles.adj && { adj: tiles.adj }),
  };
  return { templateId: template?.id ?? "", fill };
}
