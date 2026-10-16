// Chi è stato? GS 6: Ispettrice Bassi's questions, after every 4th accepted
// question. She skips her turn when the notebook cannot answer any question,
// which until PLAY-087 builds her questions is always.
import type { CaseState, EngineContent, InspectorQuestion } from "./types.ts";

export const inspectorEvery = 4;

export type AskInspector = (
  state: CaseState,
  content: EngineContent,
) => InspectorQuestion | undefined;

export const inspectorQuestion: AskInspector = () => undefined;
