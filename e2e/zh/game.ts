// Shared helpers for the game specs. The engine runs here too, so a test can read
// the saved round from IndexedDB and work out the true answer to any question.
import type { Locator, Page } from "@playwright/test";
import { content } from "../../src/languages/zh/content/index.ts";
import { evaluate, parseKey, type GameState } from "../../src/languages/zh/engine/index.ts";

export const characterOf = (id: string) => {
  const c = content.characters.find((x) => x.id === id);
  if (!c) throw new Error(`no character ${id}`);
  return c;
};
export const nameOf = (id: string) => characterOf(id).name;

// Whether `key` ("v.you|n.gou") is true for a character.
export function truth(key: string, characterId: string): boolean {
  const noun = content.lexicon.find((e) => e.id === parseKey(key).nounId);
  if (noun?.pos !== "noun") throw new Error(`no noun in ${key}`);
  return evaluate(noun, characterOf(characterId).attrs);
}

// The answer ids for a question: [right, wrong] for the given secret.
export function answersFor(key: string, characterId: string): [string, string] {
  const verb = content.lexicon.find((e) => e.id === parseKey(key).verbId);
  if (verb?.pos !== "verb") throw new Error(`no verb in ${key}`);
  return truth(key, characterId) ? [verb.yes, verb.no] : [verb.no, verb.yes];
}
export const hanziOf = (id: string) => content.lexicon.find((e) => e.id === id)?.hanzi ?? id;

// A value from the app's IndexedDB key-value store, read from inside the page.
export function stored<T>(page: Page, key: string): Promise<T | undefined> {
  return page.evaluate(
    (k) =>
      new Promise<T | undefined>((resolve) => {
        const open = indexedDB.open("shei");
        open.onsuccess = () => {
          const get = open.result.transaction("kv").objectStore("kv").get(k);
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result as T | undefined);
          };
        };
      }),
    key,
  );
}
export const savedRound = async (page: Page) =>
  (await stored<{ state: GameState }>(page, "round"))?.state;

type Guest = {
  games?: { id: string; result?: string }[];
  reviewLog?: { rating: string; lexiconId: string }[];
};
export const savedGuest = async (page: Page): Promise<Guest> =>
  (await stored<Guest>(page, "guest")) ?? {};

// A button whose Chinese text is exactly `hanzi` (pinyin above it may be shown).
export function zh(scope: Page | Locator, hanzi: string): Locator {
  const page = "page" in scope ? scope.page() : scope;
  return scope
    .getByRole("button")
    .filter({ has: page.locator('[lang="zh-Hans"]', { hasText: new RegExp(`^${hanzi}$`) }) });
}

// The Chinese in an element, without the ruby pinyin above it.
export function chineseText(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    for (const rt of copy.querySelectorAll("rt")) rt.remove();
    return copy.textContent ?? "";
  });
}

export const sheet = (page: Page) => page.getByRole("region", { name: "Questions" });
export const picker = (page: Page) => page.getByRole("list", { name: "Questions to ask" });
export const answers = (page: Page) => page.getByRole("group", { name: "Your answer" });

// A board card by the character's name (its accessible name is in Chinese).
export const card = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name}：`) });
export const guessCard = (page: Page, name: string, flipped = false) =>
  page.getByRole("button", {
    name: new RegExp(`^Guess ${name}：${flipped ? ".*\\(flipped down\\)$" : "[^(]*$"}`),
  });

// Level 2: tap tiles by their characters, then Ask.
export async function build(page: Page, ...hanzi: string[]) {
  const tiles = page.getByRole("group", {
    name: /^(Who, verbs and 吗|People|Pets and things|Places)$/,
  });
  for (const h of hanzi) await zh(tiles, h).first().click();
}

export async function waitForPhase(page: Page, phase: GameState["phase"]) {
  for (let i = 0; i < 50; i++) {
    if ((await savedRound(page))?.phase === phase) return;
    await page.waitForTimeout(50);
  }
  throw new Error(`round never reached ${phase}`);
}

// In the CPU's turn: answer its pending question rightly or wrongly. Returns the
// question key and the answer id tapped.
export async function answerCpu(page: Page, right: boolean, secret: string) {
  await waitForPhase(page, "cpuTurn");
  const key = (await savedRound(page))?.pendingCpuQuestion?.key ?? "";
  const [yes, no] = answersFor(key, secret);
  const id = right ? yes : no;
  await zh(answers(page), hanziOf(id)).click();
  return { key, id };
}

export async function collapseSheet(page: Page) {
  const toggle = page.getByRole("button", { name: /questions$/ });
  if ((await toggle.getAttribute("aria-expanded")) === "true") await toggle.click();
}
