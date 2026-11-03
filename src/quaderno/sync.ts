// Saves the workbook's progress to the signed-in account. The page itself runs and
// saves locally without this; a guest, or a build with no Supabase, stays on the device.
import { supabase } from "../core/services/supabase.ts";
import { emptyDoc, mergeDocs, parseDoc, sameDoc, type WorkbookDoc } from "./merge.ts";

type Page = {
  getDoc: () => unknown;
  replaceDoc: (doc: WorkbookDoc, options: { render: boolean }) => void;
  subscribe: (listener: () => void) => void;
  setAccount: (state: "guest" | "synced" | "saving" | "offline") => void;
};

declare global {
  interface Window {
    quaderno: Page;
  }
}

const WORKBOOK = "tutti-a-tavola-1";
const OWNER_KEY = "tat1:owner";

const readOwner = () => {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};
const writeOwner = (id: string | null) => {
  try {
    if (id) localStorage.setItem(OWNER_KEY, id);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage is blocked: the owner check just can't carry over to the next visit.
  }
};

async function start(page: Page) {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const owner = readOwner();
  if (!supabase || !session) {
    // Signed out on this device: the account's progress doesn't stay behind.
    if (owner) {
      page.replaceDoc(emptyDoc(), { render: true });
      writeOwner(null);
    }
    page.setAccount("guest");
    return;
  }
  const client = supabase;
  const userId = session.user.id;
  // Another account's progress must never merge into this one. Guest progress does.
  if (owner && owner !== userId) page.replaceDoc(emptyDoc(), { render: true });
  writeOwner(userId);

  let running = false;
  let again = false;
  let first = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const sync = async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    page.setAccount("saving");
    try {
      const { data, error } = await client
        .from("workbook_progress")
        .select("data")
        .eq("user_id", userId)
        .eq("workbook", WORKBOOK)
        .maybeSingle();
      if (error) throw error;
      const local = parseDoc(page.getDoc());
      const merged = mergeDocs(local, parseDoc(data?.data));
      // Only the first load redraws: later it could wipe answers being typed.
      if (!sameDoc(merged, local)) page.replaceDoc(merged, { render: first });
      first = false;
      const { error: saveError } = await client.from("workbook_progress").upsert({
        user_id: userId,
        workbook: WORKBOOK,
        data: merged,
        updated_at: new Date().toISOString(),
      });
      if (saveError) throw saveError;
      // A change made during this save is still waiting: don't call it saved yet.
      page.setAccount(timer || again ? "saving" : "synced");
    } catch {
      page.setAccount("offline");
    } finally {
      running = false;
      if (again) {
        again = false;
        void sync();
      }
    }
  };

  page.subscribe(() => {
    page.setAccount("saving");
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void sync();
    }, 1500);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && timer) {
      clearTimeout(timer);
      timer = undefined;
      void sync();
    }
  });
  await sync();
}

void start(window.quaderno);
