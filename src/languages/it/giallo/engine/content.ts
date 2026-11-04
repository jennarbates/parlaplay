// The content the engine reads: the giallo's, plus Chi è?'s characters (GD13).
import { content as chie } from "../../content/index.ts";
import { content as giallo } from "../content/index.ts";
import type { EngineContent } from "./types.ts";

export const engineContent: EngineContent = { ...giallo, characters: chie.characters };
