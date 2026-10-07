# 谁？ (Shéi?): MVP Spec

| | |
|---|---|
| Status | v0 draft (2026-10-07). Becomes `v1` after the sign-off in section 10.1 |
| Product name | **谁？** (*Shéi?*, "Who?"). Written `谁？` in the app and `Shei` in code, URLs and repo names. Never use "Guess Who", "Guess Who?" or any official Chinese title of that game in public branding (Hasbro trademarks; `TBD: verify` which Chinese titles Hasbro uses) |
| Sibling product | **Chi è?**, the Italian game in `jennarbates/Italian`. This game reuses its code, stack and backend design. Where this doc says "as Chi è?", the Chi è? spec section named is the reference (kept here as `docs/chi-e-spec.md`), and its code is already in this repo |
| Audience for this doc | Whoever builds, reviews, or tests the MVP, including the Mandarin reviewer |

Conventions: each section leads with the decision, then the reason. `TBD:` marks an open question. Chinese strings in this doc are the exact strings the app must produce, including full-width punctuation (`，` `。` `？`). Pinyin is written with tone marks, never tone numbers.

---

## 1. Scope and non-goals

**Goal.** A browser game where a new HSK 1 learner plays a Guess-Who style round against the computer, and every move (asking, answering) is a small, checked piece of HSK 1 Mandarin.

**Target user.** An adult learning Mandarin at new HSK 1 level (the 300-word list in the 2025 syllabus). They can read pinyin with tones, know the basic SVO sentence and 吗 questions, and recognise some characters. They play on a phone (portrait) or a laptop (1024px wide or more), in 5 to 15 minute sessions. UI chrome is in English; game content is in simplified Chinese.

**Success criteria for the MVP.**

1. Live URL at `shei.parlaplay.games` plays a full round on an iPhone (Safari), an Android phone (Chrome), and a laptop at 1024 × 640 by mouse only and by keyboard only.
2. Every word a player can see or use in a question or answer (the lexicon, section 3.3) is covered by the 2025 HSK 1 list, checked by a test against `content/hsk1.json`. Character names are the only exception (3.2).
3. `engine/` tests pass in CI with at least 90% line coverage.
4. Every item in the definition of done (10.3) is checked.
5. README explains how to run, test, and add a character.

**In and out of the MVP.**

| In MVP | Out of MVP (future, see section 11) |
|---|---|
| 24 characters, 9 attributes (gender, job, place, 2 pets, 3 things), 14 questions | Faces board (hair, eyes, clothes, colors), which needs words beyond HSK 1 |
| Every board word in the 2025 HSK 1 list | HSK 2 deck |
| Level 1: tap pre-built questions, with pinyin and English | Level 3: questions typed in pinyin or characters |
| Level 2: build questions by ordering character tiles, pinyin off by default with a toggle | A-not-A questions (`他是不是医生？`) |
| Player chooses 他 or 她 when asking | |
| Player answers CPU questions with the natural verb answer (`有` / `没有`), not yes/no | |
| Simplified characters | Traditional characters |
| CPU answers in text, with pinyin | Audio of any kind (recorded clips, TTS, speech input) |
| Mistakes tab with words and grammar points; "due words" list | Flashcard review mode; FSRS cards for grammar points |
| Spaced repetition scheduling stored per user (28 cards) | CPU choosing questions from weak words |
| Guest play (local only) and email sign-in (6-digit code) with sync | Shared accounts across parlaplay games |
| Phone layout and desktop layout (as Chi è? `spec-desktop.md`) | Native apps, offline play, installable PWA |
| Account deletion by email request | In-app account deletion, Google sign-in |
| | Multiplayer, teacher decks, leaderboards, any LLM feature |

Anything not in the left column is out. When a new idea comes up, it goes into section 11, not into the build.

---

## 2. Game rules

**Setup.** As Chi è? section 2:
- Both sides use the same 24 characters.
- The engine draws `cpuSecret` (the player must find it) and `playerSecret` (the CPU must find it) from the seed, independently. They may be the same character.
- The player sees their own secret card. The board shows all 24 characters face up and is the player's notes.
- The player always goes first.

**A turn.** On their turn, a side does exactly one of: **ask** one yes/no question, or **guess** one character. Then the turn passes.

**Questions.** Every question has the shape *pronoun + verb + object + 吗？*:

| Verb | Used for | Objects | Example |
|---|---|---|---|
| 是 *shì* | who someone is | 男的, 女的, 老师, 学生, 医生 | `她是医生吗？` |
| 有 *yǒu* | pets and things someone has | 狗, 猫, 手机, 书, 电脑 | `他有狗吗？` |
| 在 *zài* | where someone is | 家, 学校, 医院, 饭店 | `他在学校吗？` |

That gives 14 questions. The pronoun is not part of the question's identity: `他有狗吗？` and `她有狗吗？` are the same question.

**Pronouns.** The player picks 他 or 她. Both are always accepted, because the player cannot know the secret's gender until they ask (in speech both are *tā*). Once the player has asked a gender question this round (`是男的吗？` or `是女的吗？`), the gender is known. A question that then uses the other pronoun is still accepted, but the slip is shown and logged (soft error, 3.6 `gp.pron.gender`). 你 is never right: the question is about the secret person, not the CPU (hard error, `gp.pron.you`).

**Answers.** Chinese has no single word for "yes" or "no". The natural answer repeats the verb, and the negative form depends on the verb. Answers are the short answer, a comma, then the full sentence with the asker's pronoun:

| Verb | Yes | No |
|---|---|---|
| 是 | `是，{pron}是{obj}。` | `不是，{pron}不是{obj}。` |
| 有 | `有，{pron}有{obj}。` | `没有，{pron}没有{obj}。` |
| 在 | `在，{pron}在{obj}。` | `不在，{pron}不在{obj}。` |

Examples: `他有狗吗？` → `没有，他没有狗。` / `她在学校吗？` → `在，她在学校。` The answer repeats the asker's pronoun, so it never reveals the secret's gender. Pinyin of the same answer: `Méiyǒu, tā méiyǒu gǒu.`

The CPU always answers truthfully.

**CPU questions and the CPU's pronoun.** The CPU uses 她 when every character in `cpuCandidates` is a woman, 他 when every one is a man, and 他 otherwise (他 is the traditional written form when gender is unknown). `TBD:` the Mandarin reviewer confirms that the generic 他 reads naturally to learners.

**Player answering the CPU.**
- Level 1: two buttons, the yes and no forms of the question's verb (`有` / `没有`), each with pinyin.
- Level 2: seven buttons, always in this order: `是` `不是` `有` `没有` `不有` `在` `不在`. `不有` is never correct. It is there because "不有" is the classic beginner error.

A wrong answer shows the correct full answer and logs a mistake (section 6). The CPU always receives the true answer. There is no other penalty. (Reason: as Chi è? D4, a learner's slip should teach, not break the CPU's logic.)

**Flipping, winning, losing.** As Chi è? section 2: flipping is free, reversible, allowed any time during a round and never ends a turn. A right guess wins; a wrong guess loses (the official rule), so every guess goes through a confirm dialog. The CPU guesses only when one candidate remains, so its guess is always right.

**Edge cases.**

| Situation | Rule |
|---|---|
| Player asks a question already asked by the player this round, with either pronoun | Rejected as `duplicate`, turn not used, previous answer shown again |
| Player asks a question the CPU already asked | Allowed (different side, different secret) |
| Player asks `是男的吗？` after `是女的吗？` was answered | Allowed. Different question, even though the answer is already implied |
| Player uses 他 before any gender question, and the secret is a woman | Accepted, no feedback |
| Player uses 他 after learning the secret is a woman (or 她 for a man) | Accepted and answered; soft slip `gp.pron.gender` shown and logged, no rating penalty |
| Player uses 你 (Level 2) | Rejected, turn not used, mistake `gp.pron.you` logged |
| Player leaves out 吗 (Level 2) | Rejected, turn not used, mistake `gp.ma` logged |
| Player builds the right words in the wrong order, e.g. `他狗有吗` (Level 2) | Rejected, turn not used, mistake `gp.order` logged; feedback shows the right order |
| Player uses the wrong verb for the object, e.g. `他是狗吗` (Level 2) | Rejected, turn not used, `again` rating for the object, feedback names the right verb |
| Player builds `他有老师吗？` ("Does he have a teacher?") | Real Chinese, but the board cannot answer it. Rejected as `offBoard`, turn not used, no mistake logged; feedback explains 是 is for jobs |
| Player leaves a word kind out, or uses two of a kind (Level 2) | Shape error, message shown, nothing logged |
| Player answers a CPU question with `不有` | Mistake `gp.neg.mei` logged; if they meant "no", the fact is still counted as understood (section 6) |
| Player answers with the wrong verb (`有` to a `是` question) | Mistake `gp.answer.verb` logged; polarity judged separately (section 6) |
| Player turns the pinyin toggle on or off mid-round | Allowed, no effect on scoring, remembered on this device |
| Player flips all 24 cards down | Allowed. An "Unflip all" button appears. Game continues |
| Player guesses a card that is flipped down | Allowed, with a confirm dialog that says it is flipped |
| Player taps "Quit round", or starts a new round while one is saved | Old round recorded as `abandoned`, saved state discarded; ratings already logged are kept |
| App reloads mid-round | Round resumes from saved state, unless the content version changed (3.7) |
| A character in the content has no glyph in the device's fonts | Never shipped: every character used is in the system fonts checked in 10.2 (Manual) |

There is no turn limit, no timer and no match score across rounds.

---

## 3. Content model

All Chinese lives in JSON in `src/content/`, validated with Zod at build time (the Vite plugin from Chi è? fails `pnpm build` on a bad file). Every string is written out as data: there is no pinyin conversion code and no tone sandhi code.

### 3.1 Attributes

| Key | Values (lexicon ids) | Question |
|---|---|---|
| `gender` | `n.nande` 男的, `n.nvde` 女的 | `他是男的吗？` |
| `job` | `n.laoshi` 老师, `n.xuesheng` 学生, `n.yisheng` 医生 | `他是老师吗？` |
| `place` | `n.jia` 家, `n.xuexiao` 学校, `n.yiyuan` 医院, `n.fandian` 饭店 | `他在饭店吗？` |
| `dog` | boolean (`n.gou` 狗) | `他有狗吗？` |
| `cat` | boolean (`n.mao` 猫) | `他有猫吗？` |
| `phone` | boolean (`n.shouji` 手机) | `他有手机吗？` |
| `book` | boolean (`n.shu` 书) | `他有书吗？` |
| `computer` | boolean (`n.diannao` 电脑) | `他有电脑吗？` |

14 questions. Skin and hair style vary for variety but are never attributes and never asked about. No attribute depends on color, so no colorblind mode is needed.

Ids use toneless pinyin with `ü` written `v` (`n.nvde`), the common keyboard convention.

### 3.2 Characters

```ts
const Character = z.strictObject({
  id: z.string(),                    // "c.lili": "c." + toneless pinyin of the name
  name: z.string(),                  // "李丽"
  namePinyin: z.string(),            // "Lǐ Lì"
  attrs: z.strictObject({
    gender: z.enum(["n.nande", "n.nvde"]),
    job: z.enum(["n.laoshi", "n.xuesheng", "n.yisheng"]),
    place: z.enum(["n.jia", "n.xuexiao", "n.yiyuan", "n.fandian"]),
    dog: z.boolean(),
    cat: z.boolean(),
    phone: z.boolean(),
    book: z.boolean(),
    computer: z.boolean(),
  }),
  skin: z.enum(["s1", "s2", "s3", "s4", "s5"]),  // art only, never asked
  hairStyle: z.enum(["h1", "h2", "h3"]),         // art only, never asked
});
```

```json
[
  { "id": "c.lili", "name": "李丽", "namePinyin": "Lǐ Lì",
    "attrs": { "gender": "n.nvde", "job": "n.yisheng", "place": "n.yiyuan",
               "dog": false, "cat": true, "phone": true, "book": false, "computer": false },
    "skin": "s2", "hairStyle": "h1" },
  { "id": "c.wangming", "name": "王明", "namePinyin": "Wáng Míng",
    "attrs": { "gender": "n.nande", "job": "n.laoshi", "place": "n.xuexiao",
               "dog": true, "cat": false, "phone": false, "book": true, "computer": false },
    "skin": "s3", "hairStyle": "h2" }
]
```

**Names.** Character names are the only Chinese on screen outside the HSK 1 list, so they are always shown with pinyin, at every level, and are never part of a question or a card. Draft list (`TBD:` the Mandarin reviewer checks each is a natural, clearly gendered name):

| Men | Women |
|---|---|
| 王明 Wáng Míng, 张伟 Zhāng Wěi, 李强 Lǐ Qiáng, 刘洋 Liú Yáng, 陈杰 Chén Jié, 杨军 Yáng Jūn, 赵磊 Zhào Lěi, 黄涛 Huáng Tāo, 周斌 Zhōu Bīn, 吴刚 Wú Gāng, 徐亮 Xú Liàng, 孙浩 Sūn Hào | 李丽 Lǐ Lì, 王芳 Wáng Fāng, 张静 Zhāng Jìng, 刘娜 Liú Nà, 陈红 Chén Hóng, 杨雪 Yáng Xuě, 赵敏 Zhào Mǐn, 黄梅 Huáng Méi, 周颖 Zhōu Yǐng, 吴琳 Wú Lín, 徐慧 Xú Huì, 孙月 Sūn Yuè |

Name pinyin follows GB/T 16159-2012: surname and given name written apart, each capitalised.

**Content invariants (each checked by a test, not by hand).**
1. No two characters have the same 8 attribute values. This guarantees the CPU can always find a splitting question.
2. 12 men and 12 women.
3. Each job is held by 7 to 9 characters. Each place has exactly 6 characters.
4. Each of the 5 boolean questions gets "yes" from at least 5 and at most 14 characters. (`TBD:` tune after playtesting.)
5. Each character has between 1 and 3 of the 5 pets and things, so a card is never empty and never too crowded to read at 80px.
6. Ids are unique and match `c.` + the toneless pinyin of `name`, lowercased, without spaces.

**How characters are made.** `scripts/generate-characters.ts` (adapted from Chi è?) takes a seed and picks 24 attribute sets that pass every invariant, retrying until they do. It runs once by hand. Its output gets names from the table above, is reviewed, and is committed as `content/characters.json`. The seed is chosen on content day by running seeds 1 to 20,000 and keeping the one whose CPU simulation (section 5) has the lowest maximum number of questions, ties going to the lowest seed. `TBD:` record the chosen seed and its simulation numbers here.

### 3.3 Lexicon

`content/lexicon.json` is one array of entries told apart by `pos`. Every object schema is strict.

```ts
const Base = {
  id: z.string(),
  hanzi: z.string(),                    // "没有"
  pinyin: z.string(),                   // "méiyǒu", as spoken in this game (3.4)
  gloss: z.string(),                    // English, used in Level 1 hints and the Progress screen
  hsk: z.array(z.string()).min(1),      // HSK 1 headwords that cover it: ["男", "的"] for 男的
  retired: z.boolean().optional(),      // see 3.7
};

const Noun = z.strictObject({ ...Base,
  pos: z.literal("noun"),
  category: z.enum(["gender", "job", "place", "pet", "thing"]),
  verb: z.enum(["v.shi", "v.you", "v.zai"]),        // the verb this noun is asked with
  attr: z.enum(["dog", "cat", "phone", "book", "computer"]).optional(), // pets and things only
  offBoardVerbs: z.array(z.enum(["v.shi", "v.you", "v.zai"])).optional(), // real Chinese the board can't answer
});

const Verb = z.strictObject({ ...Base,
  pos: z.literal("verb"),
  yes: z.string(),                      // answer id: "a.you"
  no: z.string(),                       // answer id: "a.meiyou"
});

const Pronoun = z.strictObject({ ...Base,
  pos: z.literal("pronoun"),
  gender: z.enum(["m", "f"]).optional(), // none for 你
});

const Particle = z.strictObject({ ...Base, pos: z.literal("particle") });

const Answer = z.strictObject({ ...Base,
  pos: z.literal("answer"),
  verb: z.enum(["v.shi", "v.you", "v.zai"]),
  polarity: z.boolean(),                // true = yes
  valid: z.boolean(),                   // false only for 不有
});
```

```json
[
  { "id": "n.gou", "pos": "noun", "hanzi": "狗", "pinyin": "gǒu", "gloss": "dog",
    "hsk": ["狗"], "category": "pet", "verb": "v.you", "attr": "dog" },
  { "id": "n.laoshi", "pos": "noun", "hanzi": "老师", "pinyin": "lǎoshī", "gloss": "teacher",
    "hsk": ["老师"], "category": "job", "verb": "v.shi", "offBoardVerbs": ["v.you"] },
  { "id": "n.nvde", "pos": "noun", "hanzi": "女的", "pinyin": "nǚ de", "gloss": "female (person)",
    "hsk": ["女", "的"], "category": "gender", "verb": "v.shi" },
  { "id": "v.you", "pos": "verb", "hanzi": "有", "pinyin": "yǒu", "gloss": "to have",
    "hsk": ["有"], "yes": "a.you", "no": "a.meiyou" },
  { "id": "pr.ta.f", "pos": "pronoun", "hanzi": "她", "pinyin": "tā", "gloss": "she",
    "hsk": ["她"], "gender": "f" },
  { "id": "a.buzai", "pos": "answer", "hanzi": "不在", "pinyin": "bú zài", "gloss": "no (not at)",
    "hsk": ["不", "在"], "verb": "v.zai", "polarity": false, "valid": true },
  { "id": "a.buyou", "pos": "answer", "hanzi": "不有", "pinyin": "bù yǒu", "gloss": "(wrong: use 没有)",
    "hsk": ["不", "有"], "verb": "v.you", "polarity": false, "valid": false }
]
```

**Full MVP lexicon (28 entries).**

| Kind | Entries |
|---|---|
| Nouns (14) | 男的 nán de, 女的 nǚ de, 老师 lǎoshī, 学生 xuésheng, 医生 yīshēng, 狗 gǒu, 猫 māo, 手机 shǒujī, 书 shū, 电脑 diànnǎo, 家 jiā, 学校 xuéxiào, 医院 yīyuàn, 饭店 fàndiàn |
| Verbs (3) | 是 shì, 有 yǒu, 在 zài |
| Pronouns (3) | 他 tā, 她 tā, 你 nǐ |
| Particle (1) | 吗 ma |
| Answers (7) | 是 shì, 不是 bú shì, 有 yǒu, 没有 méiyǒu, 不有 bù yǒu (invalid), 在 zài, 不在 bú zài |

The three job nouns have `offBoardVerbs: ["v.you"]`; no other noun has the field.

**HSK check.** `content/hsk1.json` holds the 300 headwords of HSK 1 from the 2025 syllabus (`{ "source": "...", "words": ["爱", ...] }`), typed in once from the official syllabus. A content test checks that every `hsk` headword of every non-retired lexicon entry is in that list, and that every Chinese character used in lexicon, messages and rendered questions and answers appears in some HSK 1 headword (names excepted). `TBD: verify` the official syllabus document to type the list from; secondary sources agree on 300 words, released November 2025 (References). The Mandarin reviewer spot-checks 30 entries against the official list.

**Pinyin source.** Noun pinyin is copied from the HSK 1 list. `TBD:` the reviewer confirms the neutral tones the game uses (`xuésheng` versus the list's spelling, `nán de`).

### 3.4 Rendering and pinyin

**Decision: there is one sentence shape, so there are no templates (D2).** A question is `{pron}{verb}{obj}吗？`. The predicate comes from the object's `category`:

| Category | Yes when |
|---|---|
| `gender` | `attrs.gender === obj.id` |
| `job` | `attrs.job === obj.id` |
| `place` | `attrs.place === obj.id` |
| `pet`, `thing` | `attrs[obj.attr] === true` |

**Characters.** No spaces between characters. Full-width `，` `。` `？`.

**Pinyin.** Built by joining the entries' `pinyin` with single spaces, ASCII punctuation attached to the word before it (`, . ?`), and the first letter of the sentence capitalised (GB/T 16159-2012). Examples: `Tā yǒu gǒu ma?`, `Bú shì, tā bú shì yīshēng.`

**Tone sandhi.** Pinyin shows the tone as spoken in this game, because that is what learners will hear: 不 before a fourth tone is written `bú` (`bú shì`, `bú zài`). The only other sandhi in the 84 strings is third tone before third tone (`yǒu gǒu`, `yǒu shǒujī`), which is not marked, following standard dictionary practice. `TBD:` the reviewer confirms both choices. Because sandhi is stored in the answer entries' `pinyin`, not computed, the golden-string test (10.2) is the check.

**Ruby.** On screen, pinyin is shown above characters with HTML `<ruby>` per word (Level 1 always; Level 2 when the toggle is on). Every Chinese element has `lang="zh-Hans"` and every pinyin element `lang="zh-Latn-pinyin"`, so browsers pick Chinese, not Japanese, glyph shapes.

**Golden strings.** 14 questions × 2 pronouns = 28 questions; each has a yes and a no answer = 56 answers. All 84, in characters and in pinyin, are a snapshot test and are signed off by the reviewer.

### 3.5 Art manifest

As Chi è? 3.5: characters are stacked SVG layers chosen from the attributes, so the picture can never disagree with the data. The MVP ships placeholder layers; final art drops in by file name.

| z | Layer | Driven by | Files |
|---|---|---|---|
| 0 | background | `place` | `bg-jia.svg`, `bg-xuexiao.svg`, `bg-yiyuan.svg`, `bg-fandian.svg` |
| 1 | body and outfit | `gender` + `job` | `body-{m,f}-{laoshi,xuesheng,yisheng}.svg` (6) |
| 2 | face | `skin` | `face-s1.svg` ... `face-s5.svg` |
| 3 | hair | `gender` + `hairStyle` | `hair-{m,f}-{h1,h2,h3}.svg` (6) |
| 4 | book | `book` | `book.svg`, held under the left arm |
| 5 | phone | `phone` | `phone.svg`, in the right hand |
| 6 | computer | `computer` | `computer.svg`, on a small desk at the bottom centre |
| 7 | dog | `dog` | `dog.svg`, bottom left corner |
| 8 | cat | `cat` | `cat.svg`, bottom right corner |

**Placeholder rules.** Each layer must make its attribute obvious at card size (about 80px wide):
- Places: a flat backdrop color plus one large icon in the top corner: home a house, school a blackboard, hospital a red cross, restaurant a bowl with chopsticks.
- Jobs: doctor a white coat with a red cross badge; student a blue school tracksuit with backpack straps; teacher a dark jacket with a lanyard badge.
- Pets and things always sit in the fixed positions above, so an empty position is visibly empty.

If a placeholder is ambiguous the game is unfair, so this is checked in the device test (10.2). The long-press detail view is as Chi è? 3.5 (face large, no text).

### 3.6 Grammar points and feedback messages

Grammar points are mistakes that belong to a pattern, not to one word. They are shown in the Mistakes tab, grouped by point, but are not FSRS cards in the MVP (section 11).

```ts
const GrammarPoint = z.strictObject({
  id: z.string(),      // "gp.neg.mei"
  title: z.string(),   // "没有, not 不有"
  explain: z.string(), // one sentence, shown in the Mistakes tab
});
```

| Id | Title | Explain |
|---|---|---|
| `gp.ma` | 吗 questions | Put 吗 at the end of a statement to make a yes/no question. |
| `gp.order` | Word order | Who + verb + what + 吗: 他有狗吗？ |
| `gp.pron.you` | 他, 她, not 你 | You are asking about the hidden person, so use 他 or 她. |
| `gp.pron.gender` | 他 or 她 | Once you know someone is a woman, write 她; a man, 他. |
| `gp.answer.verb` | Answer with the verb | Chinese answers yes/no questions by repeating the verb. |
| `gp.neg.mei` | 没有, not 不有 | 有 is made negative with 没, never with 不. |

Every feedback string lives in `content/messages.json`, keyed by rule id, with `{placeholders}`. UI chrome is English. Chinese inside a message is never italicised (synthetic italics make characters hard to read); it is wrapped in a `lang="zh-Hans"` span and shown in the normal weight. Draft, checked by the reviewer in 10.1:

| Key | When | Message (draft) |
|---|---|---|
| `verb.shi` | Wrong verb on a gender or job | Use 是 (shì) for who someone is: {pron}是{obj}吗？ |
| `verb.you` | Wrong verb on a pet or thing | Use 有 (yǒu) for things someone has: {pron}有{obj}吗？ |
| `verb.zai` | Wrong verb on a place | Use 在 (zài) for where someone is: {pron}在{obj}吗？ |
| `offBoard.youJob` | 有 with a job | {given} asks if they have a {gloss}. To ask about their job, use 是: {pron}是{obj}吗？ |
| `gp.ma` | No 吗 | Add 吗 (ma) at the end to make a yes/no question. |
| `gp.order` | Wrong order | Chinese word order is who + verb + what + 吗. Try: {expected} |
| `gp.pron.you` | Used 你 | 你 (nǐ) means "you". Ask about them with 他 or 她. |
| `gp.pron.gender` | Pronoun against known gender (soft) | You found out they're {genderGloss}, so write {expected}. |
| `gp.answer.verb` | Answered with another verb | Answer with the question's verb: {expected} |
| `gp.neg.mei` | Answered 不有 | 有 is negated with 没: {expected} (méiyǒu). |
| `answer.wrong` | Wrong polarity | Not quite: {answerText} |
| `duplicate` | Question already asked | You already asked that. The answer was: {answerText} |
| `shape.empty` | Nothing in the tray | Tap words to build a question. |
| `shape.noPron` | No pronoun | Add who you're asking about: 他 or 她. |
| `shape.noVerb` | No verb | Add a verb: 是, 有 or 在. |
| `shape.noObj` | No object noun | Add a word to ask about. |
| `shape.extra` | Two words of one kind, or two 吗 | Use one word of each kind. |

`{genderGloss}` is `a woman` or `a man`.

### 3.7 Content ids and versions

As Chi è? 3.6: ids are permanent and never reused; a word that leaves the game stays with `retired: true`; `content/version.json` holds `contentVersion`, stored with each game; an unfinished saved game with an older version is discarded on load; `content/released-ids.json` lists every id in the last production release and a test fails if any is missing. Grammar point ids follow the same rules.

---

## 4. Engine contract

`engine/` is pure TypeScript: no React, DOM, network, or clock access, enforced by the existing lint rule. One function moves the game forward: `step(state, action, content) → { state, events }`. Randomness comes only from the seed.

### 4.1 Types

```ts
type Phase = "setup" | "playerTurn" | "playerReview" | "cpuTurn" | "cpuReview" | "over";

type QuestionKey = string; // `${verbId}|${objectId}`, e.g. "v.you|n.gou". The pronoun is not part of it

type SlotError = {
  slot: "pron" | "verb" | "order" | "ma" | "answer";
  given: string;           // text shown: "是", "他狗有吗", "不有"
  expected: string;        // "有", "他有狗吗？", "没有"
  rule: string;            // message key from 3.6
};

type ShapeError = { kind: "empty" | "noPron" | "noVerb" | "noObj" | "extra" };

type Feedback = { messageKey: string; params: Record<string, string> }[];

type AskedQuestion = {
  by: "player" | "cpu";
  key: QuestionKey;
  pron: string;            // "pr.ta.m"
  text: string;            // "他有狗吗？"
  answer: boolean;         // the truth
  answerText: string;      // "没有，他没有狗。"
  playerAnswer?: string;   // CPU questions only: the answer id chosen, "a.meiyou"
};

type GameState = {
  phase: Phase;
  seed: number;
  level: 1 | 2;
  turn: number;
  playerSecret: string;
  cpuSecret: string;
  flipped: string[];
  cpuCandidates: string[];
  cpuQuestionOrder: QuestionKey[]; // seeded shuffle of the 14 questions, fixed at START
  pendingCpuQuestion?: { key: QuestionKey; pron: string };
  history: AskedQuestion[];
  ratedThisTurn: string[];         // "lexiconId|direction"; cleared when `turn` increments
  lastFeedback?: Feedback;
  result?: "won" | "lost";
};

type Action =
  | { type: "START"; seed: number; level: 1 | 2 }
  | { type: "ASK"; tokens: string[] }            // lexicon ids in the order placed, e.g. ["pr.ta.m","v.you","n.gou","pt.ma"]
  | { type: "GUESS"; characterId: string }
  | { type: "FLIP"; characterId: string }
  | { type: "ANSWER"; answerId: string; hintShown: boolean }
  | { type: "END_TURN" };

type GameEvent =
  | { type: "rejected"; reason: "wrongPhase" | "unknownId" | "shape" | "grammar" | "offBoard" | "duplicate";
      errors?: SlotError[]; shape?: ShapeError }
  | { type: "asked"; by: "player" | "cpu"; key: QuestionKey; answer: boolean }
  | { type: "rating"; lexiconId: string; direction: "recognize" | "produce"; rating: "again" | "hard" | "good"; detail?: SlotError }
  | { type: "grammarSlip"; point: string; given: string; expected: string }
  | { type: "gameOver"; result: "won" | "lost" };
```

Level 1 builds `tokens` from the picker (the chosen pronoun, the question's verb and object, `pt.ma`), so it always passes steps 3 to 5 of 4.3. Quitting is not an engine action (as Chi è?).

### 4.2 Transition table

`R` = rejected with `wrongPhase`.

| Phase | START | ASK | GUESS | FLIP | ANSWER | END_TURN |
|---|---|---|---|---|---|---|
| setup | → playerTurn | R | R | R | R | R |
| playerTurn | R | see 4.3 | right → over (won); wrong → over (lost) | toggle | R | R |
| playerReview | R | R | R | toggle | R | CPU moves (section 5): → cpuTurn, or → over (lost) |
| cpuTurn | R | R | R | toggle | see 4.4 → cpuReview | R |
| cpuReview | R | R | R | toggle | R | → playerTurn, `turn + 1`, `ratedThisTurn` cleared |
| over | → playerTurn (new game) | R | R | R | R | R |

### 4.3 ASK validation order

The first failing step rejects, except that step 4 collects every grammar error before rejecting.

1. Phase is `playerTurn`, else `wrongPhase`.
2. Every token id exists in the lexicon and is a pronoun, verb, noun or particle, else `unknownId`.
3. **Shape.** `tokens` is non-empty (`empty`); has exactly one pronoun (`noPron` if none), one verb (`noVerb`), one noun (`noObj`), and at most one `pt.ma`; any kind appearing twice is `extra`. Rejected with reason `shape`. Nothing is logged, no rating.
4. **Grammar.** Collect all that apply:
   - pronoun is `pr.ni`: `{ slot: "pron", given: "你", expected: "他 / 她", rule: "gp.pron.you" }`
   - verb is not `noun.verb` and is not in `noun.offBoardVerbs`: `{ slot: "verb", given, expected: noun.verb's hanzi, rule: "verb.shi" | "verb.you" | "verb.zai" }` (the rule names the expected verb)
   - no `pt.ma`: `{ slot: "ma", given: tokens as text, expected: correct question, rule: "gp.ma" }`
   - order of the tokens, ignoring a missing 吗, is not pronoun, verb, noun, 吗: `{ slot: "order", given: tokens as text, expected: correct question, rule: "gp.order" }`

   If any error was collected: rejected with reason `grammar` and all errors. Events: a verb error emits `rating { noun, produce, again, detail }`; each `gp.*` error emits one `grammarSlip`. Phase stays `playerTurn`.
5. **Off board.** The verb is in `noun.offBoardVerbs`: rejected with reason `offBoard`, feedback `offBoard.youJob`, nothing logged.
6. **Duplicate.** The key `verb|noun` is already in the player's history this round: rejected with reason `duplicate`, previous answer shown, nothing logged.

On success: evaluate the predicate (3.4) against `cpuSecret`, render the question and answer with the player's pronoun, append to `history`, emit `asked`, move to `playerReview`. At Level 2 only: emit `rating { noun, produce, good }`. Then the soft check: if the player's history has a gender question (`v.shi|n.nande` or `v.shi|n.nvde`) and the pronoun's gender differs from `cpuSecret`'s gender, emit `grammarSlip { point: "gp.pron.gender", given, expected }` and add `gp.pron.gender` to the feedback. This applies at both levels, because the Level 1 pronoun switch is a real choice.

### 4.4 ANSWER rules

`expected` = the question verb's `yes` answer if the truth is yes, else its `no` answer. For the chosen answer `c`:
- `verbRight` = `c.verb` is the question's verb
- `formRight` = `c.valid`
- `polarityRight` = `c.polarity` equals the truth

Events, in this order:
1. If `!verbRight`: `grammarSlip { point: "gp.answer.verb", given: c.hanzi, expected: expected.hanzi }`.
2. If `!formRight`: `grammarSlip { point: "gp.neg.mei", given: "不有", expected: "没有" }`.
3. If `hintShown` is false (the hint exists only at Level 1) and the object's `recognize` card was not rated this turn: `rating { object, recognize, polarityRight ? "hard" : "again" }`, with `detail { slot: "answer", given: c.hanzi, expected: expected.hanzi, rule: "answer.wrong" }` when `again`.

The answer is correct only if all three are true; otherwise the feedback shows every applicable message plus the full correct answer. The CPU filters `cpuCandidates` by the truth. Phase → `cpuReview`.

At Level 1 only the two right-verb, valid buttons exist, so only polarity can be wrong.

### 4.5 Invariants (each becomes a test)

1. `playerSecret` and `cpuSecret` never change after START.
2. `cpuCandidates` always contains `playerSecret`.
3. Every `AskedQuestion.answer` equals the predicate evaluated on the asked side's secret.
4. A rejected action changes no field except `lastFeedback` and `ratedThisTurn`.
5. `history` only grows within a round.
6. `over` accepts only START.
7. Same seed and same action sequence produce the same state and events.
8. At most one `rating` per `lexiconId|direction` per turn.
9. `ratedThisTurn` is empty at the start of every player turn.
10. Every `answerText` contains the asker's pronoun and never the other one.
11. A Level 1 ASK emits no `rating` events.
12. Two questions that differ only in pronoun have the same `QuestionKey`.

### 4.6 Traced example turn

Level 2, CPU secret 李丽 (woman, doctor, at the hospital, cat, phone). No gender question asked yet.

1. Player taps tiles `他` `有` `狗` `吗`. UI dispatches `ASK { tokens: ["pr.ta.m", "v.you", "n.gou", "pt.ma"] }`.
2. Phase is `playerTurn` (ok). Ids exist (ok). Shape: one of each (ok). Grammar: pronoun not 你; `n.gou.verb` is `v.you` (ok); 吗 present; order is pronoun, verb, noun, 吗 (ok). Not off board. Key `v.you|n.gou` not asked (ok).
3. Predicate (`pet`): `attrs.dog` is `false`.
4. Render: question `他有狗吗？` (`Tā yǒu gǒu ma?`), answer `没有，他没有狗。` (`Méiyǒu, tā méiyǒu gǒu.`).
5. No gender question in history, so no pronoun check.
6. Returns `phase: "playerReview"`, the new `AskedQuestion`, `ratedThisTurn: ["n.gou|produce"]`, events `asked { by: "player", key: "v.you|n.gou", answer: false }` and `rating { n.gou, produce, good }`.
7. The progress store writes one review-log row. The player flips down everyone with a dog and presses Next (END_TURN).

**Variant: wrong verb.** Tokens `他` `是` `狗` `吗`: step 4 finds `{ slot: "verb", given: "是", expected: "有", rule: "verb.you" }`. Events: `rejected { reason: "grammar", errors: [that] }`, `rating { n.gou, produce, again, detail }`. Phase stays `playerTurn`. Feedback: "Use 有 (yǒu) for things someone has: 他有狗吗？"

**Variant: two errors.** Tokens `你` `狗` `有`: step 3 passes (one pronoun, verb, noun). Step 4 collects `gp.pron.you`, `gp.ma`, and `gp.order` (`你狗有` is not pronoun, verb, noun). Events: `rejected { reason: "grammar", errors: [3 errors] }` and three `grammarSlip` events. No `rating`, because the verb was right for the noun.

**Variant: pronoun slip.** Earlier this round the player asked `他是女的吗？` and got `是，他是女的。` Now they ask `他有猫吗？`. Accepted; answer `有，他有猫。`; events `asked`, `rating { n.mao, produce, good }`, `grammarSlip { point: "gp.pron.gender", given: "他", expected: "她" }`. Feedback adds "You found out they're a woman, so write 她."

---

## 5. CPU behavior

As Chi è? section 5, with 14 questions: the CPU always asks the question whose "yes" count among `cpuCandidates` is closest to half, ties broken by `cpuQuestionOrder`; it guesses when one candidate remains; it answers truthfully; it filters by the true answer.

**Pronoun.** Chosen when the question is set (section 2): 她 if every candidate is a woman, 他 if every one is a man, otherwise 他. Stored in `pendingCpuQuestion.pron`.

**Measured length.** `node scripts/simulate.ts` (1,000 games) reports the CPU's mean and maximum number of questions for the chosen seed. Fewer questions split 50/50 than in Chi è? (places split 6 to 18), so the mean is expected to be a little above log2 24 ≈ 4.6. `TBD:` record the measured mean, maximum, and the player's win rate when playing as well as the CPU. If the CPU needs fewer than 5 on average and learners lose most playtest rounds, the planned fix is the Easy setting in section 11, not a weaker default (as Chi è? D8).

---

## 6. Learning model

As Chi è? section 6 (FSRS with `ts-fsrs`, default parameters, desired retention 0.9; computed, stored and shown, but nothing in gameplay reads it yet), with these differences.

**Cards.** One card per `(noun id, direction)`: 14 nouns × 2 = 28 cards.
- `recognize`: Chinese → meaning. Exercised when answering a CPU question.
- `produce`: meaning → Chinese. Exercised when building a question at Level 2.

Verbs, pronouns, 吗 and answers are not cards. A wrong verb is rated against the noun, because choosing the verb means knowing what kind of thing the noun is (as Chi è? rates articles against nouns).

**Event → rating.**

| Game event | Cards | Rating |
|---|---|---|
| Level 2 question accepted | produce: the noun | good |
| Level 2 question accepted with a pronoun slip | produce: the noun good | plus a `slip` row for `gp.pron.gender` |
| Level 2 question rejected for the wrong verb | produce: the noun | again |
| Level 2 question rejected for 你, missing 吗 or order only | none | one `slip` row per grammar point |
| Level 1 question tapped | none | none (exposure only); a pronoun slip still writes a `slip` row |
| `offBoard`, `duplicate`, or a shape error | none | none |
| CPU question answered with the right polarity, hint not shown | recognize: the noun | hard (capped: a two-way choice can be right by luck, as Chi è? D7) |
| CPU question answered with the wrong polarity | recognize: the noun | again, with `detail` for the Mistakes tab |
| CPU question answered with the wrong verb or 不有 | as polarity says | plus a `slip` row per grammar point |
| Hint shown before answering | none | none (grammar slips still logged) |

**Review log.** As Chi è?: append-only, source of truth, cards rebuilt by replay. `slip` rows carry the grammar point id in `lexiconId` (e.g. `gp.neg.mei`) and `detail` `{ given, expected }`. FSRS replay skips `slip` rows. No daily new-card limit.

---

## 7. Data and backend

As Chi è? section 7: Supabase (Postgres and Auth) with Row Level Security, no custom server code, guests local only. Schema and policies are identical and are written out below so this repo stands alone.

**Environments.**

| Environment | Supabase | Used by |
|---|---|---|
| Local | Supabase CLI in Docker; local inbox for sign-in emails | Development, Vitest sync tests, Playwright, CI |
| Staging | Free cloud project `shei-staging` | Pull request preview deploys, from Thu Oct 29 |
| Production | Project `shei-prod` in the paid organization Chi è? moves to Pro at its launch | `main` deploys at `shei.parlaplay.games` |

**Why staging starts late.** Supabase's free plan allows 2 active free projects, and Chi è? uses both (staging and production) until it upgrades on Wed Oct 28. Until Shéi staging exists, preview deploys are built with no Supabase settings and run guest-only (8.2, "Sign-in unavailable"). `TBD: verify` whether the 2-project limit counts per organization or across every organization the owner belongs to; if per organization, `shei-staging` can be made on day 2 in a new free organization.

**Production cost.** On the Pro plan each additional project adds its own compute; the $10 monthly credit covers one Micro instance, which Chi è? production uses. `shei-prod` on Micro therefore adds about $10 a month (References).

Migrations live in `supabase/migrations/` and are applied local → staging → production with the CLI before merging code that needs them. The app holds only the public (publishable or anon) key.

### 7.1 Tables

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  level smallint not null default 1 check (level in (1, 2)),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.games (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  seed bigint not null,
  level smallint not null check (level in (1, 2)),
  content_version int not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  result text check (result in ('won', 'lost', 'abandoned'))
);

create table public.review_log (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id uuid references public.games (id) on delete set null,
  lexicon_id text not null,                              -- a noun id, or a grammar point id on slip rows
  direction text not null check (direction in ('recognize', 'produce')),
  rating text not null check (rating in ('again', 'hard', 'good', 'slip')),
  detail jsonb,
  local_day date not null,
  created_at timestamptz not null
);

create index review_log_user_created on public.review_log (user_id, created_at);

create table public.cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  lexicon_id text not null,
  direction text not null check (direction in ('recognize', 'produce')),
  state jsonb not null,
  due timestamptz not null,
  log_count int not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, lexicon_id, direction)
);

create function public.cards_keep_newest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.log_count < old.log_count then
    return null;
  end if;
  return new;
end;
$$;

create trigger cards_keep_newest
  before update on public.cards
  for each row execute function public.cards_keep_newest();
```

`slip` rows need a `direction` value: answer-side slips use `recognize`, question-side slips use `produce`.

### 7.2 RLS policies

```sql
alter table public.profiles   enable row level security;
alter table public.games      enable row level security;
alter table public.review_log enable row level security;
alter table public.cards      enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy games_select on public.games for select to authenticated
  using ((select auth.uid()) = user_id);
create policy games_insert on public.games for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy games_update on public.games for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- append-only: no update or delete policy exists, so both are denied
create policy review_log_select on public.review_log for select to authenticated
  using ((select auth.uid()) = user_id);
create policy review_log_insert on public.review_log for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (game_id is null or exists (
      select 1 from public.games g
      where g.id = game_id and g.user_id = (select auth.uid())
    ))
  );

create policy cards_select on public.cards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy cards_insert on public.cards for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy cards_update on public.cards for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
```

The `anon` role has no policies, so it can read and write nothing.

### 7.3 Auth and sync rules

As Chi è? 7.3 in full (6-digit email code only, guest data in IndexedDB under `guest`, `navigator.storage.persist()`, guest nudge, "Save your progress to this account?" upload, outbox with `games` before `review_log`, union merge and replay, `log_count` guard, unsynced sign-out warning, account deletion by email within one month), with these differences:

- **Email.** Sign-in codes are sent through the same AWS SES account as Chi è?, from a new verified domain identity `shei.parlaplay.games` (SPF, DKIM, DMARC records in Cloudflare DNS). SES production access is granted per account and per Region, so if Chi è? already left the sandbox in that Region, Shéi needs only the new identity. If Chi è? fell back to Resend, Shéi does too. Staging uses Supabase's built-in sender.
- **Separate accounts.** A Chi è? account and a Shéi account are different users in different projects, even with the same email. The privacy note says so. Shared accounts are future work.
- **Local settings.** The Level 2 pinyin toggle and the Level 1 pronoun switch are stored per device in IndexedDB (`settings` store), not synced, and kept on sign-out.

---

## 8. UX

As Chi è? section 8 and `spec-desktop.md`, which come with the copied code. Below are only the differences. The phone board still fits 360 × 560 (a 360 × 640 phone after browser toolbars) with the bottom sheet collapsed; the desktop board still fits 1024 × 640 with no page scroll.

### 8.1 Screens

Same screens, flow and routes (`/`, `/play`, `/progress`, `/settings`, `/privacy`). Changes:

| Screen | Change |
|---|---|
| Home | Title `谁？` with `Shéi?` below it |
| Game: card | Face art, then the name in characters with its pinyin below, both on the card at every level |
| Game: Level 1 picker | Pronoun switch at the top (`他` / `她`, default `他`). The 14 questions, each with ruby pinyin and its English gloss ("Is he a doctor?"). Asked questions greyed out with their answer |
| Game: Level 2 builder | A tray line above the tiles: one row with the pronouns `他 她 你`, the verbs `是 有 在` and `吗` (7 tiles), then the 14 nouns in three rows. Tapping a tile appends it to the tray; tapping a tile in the tray removes it; "Clear" empties it; the tray holds at most 6 tiles and ignores further taps. "Ask" submits. A "Pinyin" toggle shows ruby pinyin on every tile and in the tray |
| Game: CPU question | The question with ruby pinyin at Level 1 (characters only at Level 2 unless the toggle is on); "Show hint" reveals English at Level 1; answer buttons as section 2 |
| Game: buttons | English: "Guess", "Next", "Ask", "Quit round". Reason: HSK 1 has no word for "guess", and English chrome matches the rest of the UI |
| Progress: Mistakes | Grouped by noun or by grammar point; a grammar point shows its title and explanation from 3.6 |
| Privacy | As Chi è?, with Shéi's domain and the note that accounts are separate from Chi è? |

### 8.2 States

As Chi è? 8.2 and `spec-desktop.md` DS 11, plus:

| State | Where | Behavior |
|---|---|---|
| Sign-in unavailable | Settings and the guest nudge, on a build with no Supabase settings | Sign-in is hidden; Settings shows "Sign-in isn't available on this preview." Guest play works |
| Pronoun slip | Game, after a question is accepted | The answer, then the soft message in a muted line below it |

### 8.3 Desktop keys

As `spec-desktop.md` DS 8, with these keys changed because the Italian ones were Italian words:

| Key | Action | Replaces |
|---|---|---|
| `g` | Guess | `g` Indovina (same key) |
| `n` | Next (END_TURN) | `a` Avanti |
| `1`, `2` | Level 1 answers, in button order | `s` Sì, `n` No |
| `1` to `7` | Level 2 answers, in button order (`是 不是 有 没有 不有 在 不在`) | `s`, `n` |
| `p` | Pinyin toggle (Level 2) | new |
| `t` | Pronoun switch (Level 1) | new |
| Enter in the tray | Ask | Chiedi |

Level 2 has no tile letter keys, as DS 8 (DD8).

---

## 9. Non-functional

**Browsers, stack, accessibility target, performance budgets, error reporting, cheating.** As Chi è? section 9 and `spec-desktop.md` DS 12, unchanged: current and previous major versions of iOS Safari, Android Chrome and desktop Chrome, Firefox, Safari, Edge; React, TypeScript (strict), Vite, React Router, Zustand, Tailwind CSS, Zod, `ts-fsrs`, Supabase JS, `idb`; Vitest, fast-check, Playwright; pnpm, ESLint, Prettier; WCAG 2.2 AA; initial JS under 250 KB gzipped, LCP under 2.5 s on Lighthouse mobile, `step()` under 5 ms; Sentry errors only with every data collection category off and URLs scrubbed.

**Fonts.** System fonts only: `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif` for Chinese. No web font, because a full Chinese font is several megabytes and would break the 250 KB budget. Every element with Chinese text has `lang="zh-Hans"` (3.4).

**Accessibility additions.**
- Each card's accessible name is in Chinese with `lang="zh-Hans"`, e.g. `李丽：女的，医生，在医院，有猫，有手机`. `TBD:` check on the real devices that VoiceOver and TalkBack switch to a Chinese voice for it; if not, add pinyin to the name.
- Ruby pinyin is exposed to screen readers only where it is visible.
- Touch targets for tiles are at least 44 × 44 px, so the 21 tiles take four rows on a 360px phone.

**Repo.** A separate repository `jennarbates/Chinese`, started from Chi è? `main` at `29a45c1` with its full history, then Italian content removed and renamed. Chi è? is the `italian` remote (fetch only; pushing is disabled). Reason: the two games will diverge in content and engine, so they stay separate repos; keeping the shared history lets Chi è? fixes come over with `git cherry-pick` from `italian/main`, and makes a later merge into one repo a normal merge. Each cherry-picked or skipped Chi è? fix gets a line in `docs/port-log.md`. Whether to merge the two into one repo with a shared package is decided after both launch (section 11.1). Branches are named `shei-<issue number>-<short name>`.

**Folder structure.** As Chi è?, with these content files:

```
src/
  engine/      pure TS: types, step, ask (shape, grammar, order), answer, render, cpu
  content/     characters.json, lexicon.json, grammar.json, messages.json, hsk1.json, version.json, released-ids.json
  services/    storage, sync, srs, errors (unchanged)
  store/       gameStore, progressStore, settingsStore
  ui/          Board, Card, Ruby, CardDetail, BottomSheet, QuestionPicker, TileTray, AnswerButtons, RoundEnd, Progress, Settings, SignInSheet, Privacy
public/art/    SVG layers named as in 3.5
scripts/       generate-characters.ts, simulate.ts
supabase/      migrations/
e2e/           Playwright tests
spec.md        this file
spec-desktop.md  copied from Chi è?, unchanged; this file's 8.3 overrides its keys
```

**CI and deploy.** As Chi è?: GitHub Actions runs typecheck, lint, Vitest and Playwright on every push and pull request with a local Supabase; `main` is protected; Cloudflare builds each pull request to a preview URL (with `shei-staging` settings once it exists); merging to `main` deploys production.

**Privacy.** As Chi è?: guest data never leaves the device; accounts store email, profile, games, review log and cards; no analytics. Third parties: Supabase (database and sign-in), Cloudflare (hosting, sees IPs), AWS SES or Resend (sees the email address), Sentry (errors, personal data stripped). The Supabase region for `shei-prod` matches Chi è? production.

**Hosting.** Cloudflare Workers static assets at `shei.parlaplay.games`, with `assets.not_found_handling = "single-page-application"`. Requests to static assets are free and unlimited on every plan, and commercial use is allowed. Rejected alternatives as Chi è? D11 and D29 (Vercel free is non-commercial; GitHub Pages forbids running a business and has no previews). The Sentry project lives in the same Sentry account as Chi è?; `TBD: verify` the free plan's error quota and whether it is shared between projects.

---

## 10. Test plan and definition of done

### 10.1 Spec sign-off (before building)

1. Trace one full game on paper using only this doc (and the Chi è? sections it points to). Every guess becomes a `TBD:` or a fix.
2. The Mandarin reviewer checks: all 84 golden strings in characters and pinyin (3.4); the generic 他 (section 2); the answer format; the tone sandhi and neutral tone choices (3.3, 3.4); the classification of `不有` (and whether `没在` should be offered); the 24 names (3.2); every message and grammar explanation (3.6); and 30 HSK entries against the official list.
3. A developer reviews sections 4 and 7. `TBD:` name the developer reviewer; if there is none, the owner does a second paper trace of 4.3 and 4.4 a day after writing them.
4. Tag the doc `v1`. After that, every change adds a dated line to the changelog.

### 10.2 Tests

| Layer | Tool | What |
|---|---|---|
| Content | Vitest | All JSON passes Zod; every invariant in 3.2; every id and message key referenced exists; every `hsk` headword is in `hsk1.json`; every Chinese character used outside names is in an HSK 1 headword; pinyin uses tone marks only; no id in `released-ids.json` is missing |
| Engine | Vitest | Every cell of the transition table; every invariant in 4.5; the four traced turns in 4.6; every ANSWER combination in 4.4 (7 answers × 3 verbs × 2 truths = 42 cases) |
| Engine | fast-check | Random action sequences never break the invariants; random token lists never throw and always return exactly one of accepted, shape, grammar, offBoard, duplicate |
| Rendering | Vitest snapshot | All 28 questions and 56 answers in characters and pinyin as golden strings, signed off by the reviewer; answers contain only the asker's pronoun |
| Grammar | Vitest | Each wrong verb for each of the 14 nouns gives the right rule; 有 with each job is `offBoard`; 你, missing 吗, and each of the 23 wrong orders of 4 tokens give their errors; errors combine as in 4.6; each `ShapeError` kind; the pronoun slip fires only after a gender question |
| CPU | Vitest | Always finds a splitting question; never guesses wrong; same seed gives the same game; pronoun rule in section 5 |
| SRS | Vitest | Event → rating table in section 6; `slip` rows skipped in replay; rebuild equals incremental state |
| Sync | Vitest + local Supabase | As Chi è? (idempotent guest upload, games before review rows, two-device merge, stale `cards` upsert ignored, profile row, RLS blocks another user's rows) |
| E2E | Playwright (Chromium, WebKit) | Seeded round to a win at each level; wrong guess loses; quitting records `abandoned`; sign-in with a code from the local inbox; reload mid-round resumes; `/play` loads directly; a desktop round by keyboard only with the keys in 8.3 |
| Manual | Real iPhone, Android phone, Windows laptop, Mac laptop | Board fits after browser toolbars; every character renders in the system font with Chinese glyph shapes; ruby pinyin readable at card size; every placeholder attribute readable at 80px (each of the 24 cards checked against its data); screen reader reads card names in Chinese |
| Playtest | 3 or more HSK 1 learners | Each plays 3 rounds (at least one at Level 2); note rounds lost, minutes per round, and every confusing string |

### 10.3 Definition of done

- [ ] Deployed URL plays a full round on an iPhone.
- [ ] Deployed URL plays a full round on an Android phone.
- [ ] Deployed URL plays a full round on a laptop at 1024 × 640 by mouse only and by keyboard only.
- [ ] All 24 characters render with art that matches their attributes (checked card by card).
- [ ] Level 1 and Level 2 are both playable to a win and a loss.
- [ ] A Level 2 grammar mistake (wrong verb, 你, missing 吗, wrong order) shows feedback naming the rule and appears in the Mistakes tab.
- [ ] Answering `不有` or with the wrong verb shows the right answer and logs the grammar point.
- [ ] The content test proves every lexicon word is in the 2025 HSK 1 list.
- [ ] The Mandarin reviewer has signed off all 84 golden strings.
- [ ] Guest progress survives a reload.
- [ ] Signing in with guest progress uploads it; signing in on a second browser shows the same Progress.
- [ ] RLS test proves user A cannot read user B's `review_log`.
- [ ] A sign-in code email from `shei.parlaplay.games` reaches an address outside the team.
- [ ] The privacy note is live, gives the deletion email, and says accounts are separate from Chi è?; one deletion tested on staging.
- [ ] A pull request preview signs in against staging, never production.
- [ ] Sentry receives a test error from production with no personal data.
- [ ] At least 3 HSK 1 learners have playtested; findings logged and triaged.
- [ ] `engine/` coverage at or above 90%; CI green.
- [ ] Lighthouse mobile: LCP under 2.5 s, accessibility score at least 95.
- [ ] Every `TBD:` here is resolved or moved to section 11.
- [ ] README covers run, test, deploy, and adding a character.

### 10.4 Milestones

**Capacity assumption.** Shéi is planned in parallel with the Chi è? launch (Thu Oct 29), so until then it gets **half days**; from Fri Oct 30 it is full time. `TBD:` confirm this split. Work that waits on other people (the Mandarin review, finding playtesters, SES identity, DNS) starts on step 1. Three full days are left after the playtest for fixes.

| Step | Dates | Capacity | Deliverable | Done when |
|---|---|---|---|---|
| 1 | Thu Oct 8 | Half | Send the reviewer section 3 and the questions in 10.1; start recruiting 3 or more HSK 1 playtesters for Fri Nov 6; add DNS for `shei.parlaplay.games` | Review requested with a due date of Wed Oct 14; recruiting message sent; subdomain resolves |
| 2 | Fri Oct 9 to Tue Oct 13 | Half | New repo from a copy of Chi è? `main`; rename; Italian content replaced by stubs; CI green; Cloudflare Worker and previews; Sentry project; SES domain identity for `shei.parlaplay.games` | CI green on the stub app; a pull request gets a guest-only preview URL; SES identity verified |
| 3 | Wed Oct 14 to Mon Oct 19 | Half | `hsk1.json`, lexicon, grammar points, messages, character generator with seed search, names, placeholder SVG layers; fold in the review | Content tests pass; all 24 characters render; spec tagged `v1` |
| 4 | Tue Oct 20 to Wed Oct 28 | Half | Engine: token ASK with shape, grammar and order checks; ANSWER rules; rendering and pinyin; CPU with pronoun rule; simulation | All engine tests pass; coverage at 90%; simulation numbers recorded in section 5 |
| 5 | Thu Oct 29 | Half | Create `shei-staging` once Chi è? production is on Pro; point previews at it | A preview build talks to `shei-staging` |
| 6 | Fri Oct 30 | Full | Board UI: card art, names with pinyin, `Ruby`, `lang` attributes, system fonts; phone and desktop layouts | 24 cards fit 360 × 560 and 1024 × 640 |
| 7 | Mon Nov 2 | Full | Level 1 picker with pronoun switch; Level 2 tile tray with pinyin toggle; feedback | Can ask and read answers on a real iPhone at both levels |
| 8 | Tue Nov 3 | Full | CPU turn, answer buttons (2 and 7), guessing, round end, quit; desktop keys from 8.3 | Full round to a win and a loss by touch and by keyboard |
| 9 | Wed Nov 4 | Full | Progress with grammar points, FSRS for 28 cards; migrations on staging; sign-in email through SES | Sync and RLS tests pass; a code email reaches an outside address |
| 10 | Thu Nov 5 | Full | Accessibility, states from 8.2, privacy note, real device pass, playtest build on staging | Manual checklist done; playtest build ready |
| 11 | Fri Nov 6 | Full | Playtests with 3 or more HSK 1 learners | Findings logged and triaged |
| 12 to 14 | Mon Nov 9 to Wed Nov 11 | Full | Fix playtest findings | Every must-fix finding fixed |
| 15 | Thu Nov 12 | Full | Create `shei-prod` in the paid organization, apply migrations, connect SES; README; definition of done sweep | Every 10.3 box checked |
| 16 | Fri Nov 13 | Full | Launch | `shei.parlaplay.games` live on production |

---

## 11. Future work and decision log

### 11.1 Future work

**Audio.** Left out of the MVP by choice, even though tones are hard to learn from pinyin alone. The game only ever says 28 questions, 56 answers and 7 answer words: 91 clips, generated once with a high-quality voice, checked by the Mandarin reviewer, and shipped as files (as Chi è? 11.1). A Level 3 "listen only" mode and speech input build on it.

**Typed input (Level 3).** Players type the question in pinyin (with or without tone numbers) or characters with their own IME. Needs a tokenizer that maps input to lexicon ids, then reuses the same validation (4.3), which was designed for token lists for this reason.

**A-not-A questions.** `他是不是医生？` and `他有没有狗？` are common and HSK 1 level. They add a second question shape, so they wait until the first shape is proven.

**HSK 2 deck and the faces board.** HSK 2 adds colors, clothes and body words, so a faces board like Chi è?'s becomes possible. The content model already supports more categories.

**Grammar point cards.** Make `gp.*` FSRS cards so grammar is scheduled like words. Needs a way to practise a grammar point on demand, so it comes with SRS-weighted CPU questions.

**Shared accounts and a shared engine package.** One parlaplay account across games, and the common engine, sync and UI moved into a package both repos use. Worth it once a third game is planned.

**Traditional characters.** A setting that swaps every string for a traditional version, written out as data. Needs a second golden-string review.

Also queued, as Chi è?: final art, Easy CPU setting, championship mode, Google sign-in, in-app account deletion, offline PWA, multiplayer.

### 11.2 Decision log

| Id | Decision | Reason |
|---|---|---|
| D1 | Board of people and things (gender, job, place, pets, things) instead of faces | HSK 1 has no words for hair, eyes, glasses, hats or colors; this board uses only HSK 1 words |
| D2 | One question shape, no templates; the object's category picks the predicate | Every HSK 1 question here is pronoun + verb + object + 吗; templates would add nothing |
| D3 | The 2025 HSK 1 list (300 words) is the reference | It replaces the old 150-word list from the July 2026 exams onward |
| D4 | Every board word is checked against `hsk1.json` by a test; names are the only exception | The game's promise is "HSK 1 only"; a test keeps it true as content changes |
| D5 | Answers repeat the verb (`有` / `没有`), then give the full sentence | That is how Chinese answers yes/no questions, and it teaches 不 versus 没 every turn |
| D6 | Answers repeat the asker's pronoun | The answer must never reveal the secret's gender |
| D7 | The player may use 他 or 她; a mismatch after the gender is known is a soft slip | Before asking, the player cannot know; after, choosing the right one is a real skill worth showing without punishing |
| D8 | The CPU uses 他 unless all its candidates share a gender | 他 is the traditional form for unknown gender; using 她 only when certain is natural |
| D9 | Level 2 is a free-order tile tray, not fixed slots | Word order is the core HSK 1 grammar skill; fixed slots would remove it |
| D10 | Level 2 answers offer 7 buttons including the invalid `不有` | Choosing the verb and its negation is the skill; `不有` is the most common beginner error |
| D11 | `有` + job is rejected without logging a mistake | `他有老师吗？` is correct Chinese; marking it wrong would teach something false |
| D12 | Grammar points are logged as `slip` rows, not FSRS cards | Gives a useful Mistakes tab without designing grammar practice yet |
| D13 | Pinyin shows 不 sandhi (`bú shì`) but not third-tone sandhi | Matches what learners hear and what dictionaries print |
| D14 | Simplified characters, pinyin always at Level 1, toggle at Level 2 | HSK uses simplified; Level 2 should push reading characters without stranding the learner |
| D15 | No audio in the MVP | The owner's choice for a smaller build; clips are the first future feature |
| D16 | English UI chrome and buttons | HSK 1 lacks words like "guess"; consistent with Chi è?'s English chrome |
| D17 | System fonts with `lang="zh-Hans"`, no web font | A Chinese web font would blow the 250 KB budget; `lang` prevents Japanese glyph shapes |
| D18 | New repo copied from Chi è?, no shared package yet | Two games are not enough to know what should be shared |
| D19 | Separate Supabase projects and accounts from Chi è? | Keeps each game's data and RLS simple; shared accounts are future work |
| D20 | `shei-staging` created after Chi è? goes Pro; guest-only previews before that | The free plan allows 2 active projects and Chi è? uses both |
| D21 | Same SES account, new domain identity | Production access is per account and Region, so Shéi inherits it |
| D22 | Half-day capacity until Oct 29, launch Fri Nov 13 | Built in parallel with the Chi è? launch, with 3 fix days after the playtest |
| D23 | Each character has 1 to 3 pets and things | A card with all five is unreadable at 80px; one with none looks broken |
| D24 | Desktop layout from day 1, reusing `spec-desktop.md` | The code exists already; only keys change |
| D25 | Name `谁？` (Shéi?), on `shei.parlaplay.games` | 谁 is itself an HSK 1 word, and the name avoids Hasbro's marks |

---

## References

- Mandarin Zone, New HSK 1 vocabulary list (cites the 2025 CLEC syllabus): https://www.mandarinzone.com/hsk-1-vocabulary-list-excel-with-3-free-quiz-sheets/
- StudyCLI, HSK 1 vocabulary (300 words): https://studycli.org/zh-CN/chinese-tools/hsk-1-vocabulary/
- Mandarin Bean, New HSK 1 word list: https://mandarinbean.com/new-hsk-1-word-list/
- HSK Lord, HSK 3.0 guide and timeline: https://hsklord.com/blog/new-hsk-3-0-complete-guide
- Wikipedia, Hanyu Shuiping Kaoshi: https://en.wikipedia.org/wiki/Hanyu_Shuiping_Kaoshi
- GB/T 16159-2012, Basic rules of Hanyu Pinyin orthography (2012 revision summary): https://pinyin.info/news/2015/prcs-official-rules-for-pinyin-2012-revision/
- Basic rules of Hanyu Pinyin orthography (English translation): https://www.pinyin.info/readings/zyg/rules.html
- Supabase pricing: https://supabase.com/pricing
- Cloudflare Workers pricing (static assets free and unlimited): https://developers.cloudflare.com/workers/platform/pricing/
- Amazon SES, moving out of the sandbox (per account, per Region): https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- Chi è? `spec.md` and `spec-desktop.md`: https://github.com/jennarbates/Italian

---

## Changelog

- 2026-10-07: v0 draft.
- 2026-10-07: Repo (section 9) starts from Chi è?'s history instead of a files-only copy, with an `italian` remote for cherry-picking fixes; Chi è?'s spec kept as `docs/chi-e-spec.md`.
