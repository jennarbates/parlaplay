// Spec 3.4: questions are {pron}{verb}{obj}吗？ and answers are the short answer,
// a comma, then the full sentence with the asker's pronoun (spec 2, D5, D6).
// Pinyin is written out in the lexicon, never computed: words are joined with
// spaces, punctuation sticks to the word before it, and the first letter is
// capitalised (GB/T 16159-2012).
import { indexContent, ma, need } from "./content.ts";
import type { EngineContent } from "./types.ts";

// One word, or one punctuation mark (no lexiconId), of a rendered sentence. The
// UI uses these to show ruby pinyin word by word.
export type Segment = { hanzi: string; pinyin: string; lexiconId?: string };

export type Sentence = { hanzi: string; pinyin: string; segments: Segment[] };

const punctuation = { "，": ",", "。": ".", "？": "?" } as const;

function sentence(segments: Segment[]): Sentence {
  let pinyin = "";
  for (const s of segments) {
    if (s.lexiconId === undefined) pinyin += s.pinyin;
    else pinyin += (pinyin ? " " : "") + s.pinyin;
  }
  return {
    hanzi: segments.map((s) => s.hanzi).join(""),
    pinyin: pinyin.charAt(0).toUpperCase() + pinyin.slice(1),
    segments,
  };
}

function word(content: EngineContent, id: string): Segment {
  const e = need(indexContent(content).entry, id);
  return { hanzi: e.hanzi, pinyin: e.pinyin, lexiconId: e.id };
}

const mark = (hanzi: keyof typeof punctuation): Segment => ({
  hanzi,
  pinyin: punctuation[hanzi],
});

// 他有狗吗？ / Tā yǒu gǒu ma?
export function renderQuestion(
  content: EngineContent,
  pronId: string,
  verbId: string,
  nounId: string,
): Sentence {
  return sentence([
    word(content, pronId),
    word(content, verbId),
    word(content, nounId),
    word(content, ma),
    mark("？"),
  ]);
}

// 没有，他没有狗。 / Méiyǒu, tā méiyǒu gǒu.
export function renderAnswer(
  content: EngineContent,
  pronId: string,
  verbId: string,
  nounId: string,
  truth: boolean,
): Sentence {
  const verb = need(indexContent(content).verb, verbId);
  const short = word(content, truth ? verb.yes : verb.no);
  return sentence([
    short,
    mark("，"),
    word(content, pronId),
    short,
    word(content, nounId),
    mark("。"),
  ]);
}

// Tokens as the player placed them, with no punctuation: "他狗有吗".
export function tokensText(content: EngineContent, tokens: string[]): string {
  const index = indexContent(content);
  return tokens.map((id) => index.entry.get(id)?.hanzi ?? "").join("");
}
