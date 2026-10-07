// Spec 4.1: the shell's state, actions and effects.
import type { LanguageCode, LanguageEntry } from "../languages.ts";

// The reducer only needs the codes, in registry order.
export type Registry = readonly Pick<LanguageEntry, "code">[];

export type Account = { kind: "guest" } | { kind: "signedIn"; userId: string };

export type Prompt =
  | { kind: "saveGuest"; languages: LanguageCode[] }
  | { kind: "unsyncedSignOut" };

export type ShellState = {
  hydrated: boolean; // the app key has been read from IndexedDB
  path: string | null; // the path of the last OPEN
  language: LanguageCode | null; // the language whose routes are open
  lastLanguage: LanguageCode | null;
  account: Account;
  prompt: Prompt | null;
};

export type ShellAction =
  | { type: "HYDRATED"; lastLanguage: LanguageCode | null } // the app key has been read
  | { type: "OPEN"; path: string } // any navigation, including the first load
  | { type: "CHOOSE"; code: LanguageCode } // a picker card, or starting a round
  | {
      type: "SIGNED_IN";
      userId: string;
      serverLast: LanguageCode | null;
      guestLanguages: LanguageCode[]; // languages with guest rows on this device, read at sign-in
    }
  | { type: "SAVE_GUEST"; answer: "yes" | "no" }
  | { type: "SIGN_OUT"; unsynced: boolean }
  | { type: "CONFIRM_SIGN_OUT"; answer: "signOut" | "wait" };

export type ShellEffect =
  | { type: "navigate"; to: string; replace: boolean }
  | { type: "write"; key: "app"; value: { lastLanguage: LanguageCode } }
  | { type: "writeProfile"; lastLanguage: LanguageCode }
  | { type: "uploadGuest"; languages: LanguageCode[] }
  | { type: "deleteGuest"; languages: LanguageCode[] }
  | { type: "signOut" };

export type ShellResult = { state: ShellState; effects: ShellEffect[] };

// 4.3: what a path is, before any state is involved.
export type SharedPage = "languages" | "settings" | "privacy" | "import";
export type Route =
  | { kind: "root" }
  | { kind: "page"; page: SharedPage }
  | { kind: "language"; code: LanguageCode }
  | { kind: "notFound" };
