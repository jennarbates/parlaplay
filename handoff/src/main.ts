// Platform spec 5.3: all that chie.parlaplay.games serves after the move. With no
// Chi è? data it redirects at once. With data it shows the message and carries the
// data to parlaplay.games/import in the URL fragment, which never reaches a server.
// It reads IndexedDB only: never localStorage, where Supabase keeps the session.
import { encodeJson, maxEncodedLength } from "../../src/core/handoff/encoding.ts";
import { buildHandoff, importUrl, messages, redirectUrl } from "./chie.ts";
import { readChie } from "./read.ts";

// parlaplay.games, or where a staging or test build says it is.
const site = (import.meta.env.VITE_PARLAPLAY_URL ?? "https://parlaplay.games").replace(/\/+$/, "");

async function move() {
  const { pathname } = window.location;
  const handoff = buildHandoff(await readChie());
  if (!handoff) return window.location.replace(redirectUrl(site, pathname));

  const message = document.getElementById("message");
  if (message) message.textContent = messages.moving;
  let data: string;
  try {
    data = await encodeJson(handoff);
  } catch {
    // No CompressionStream (a browser older than 9 supports): /import's failure
    // screen offers Start fresh.
    return window.location.replace(importUrl(site, pathname, ""));
  }
  if (data.length > maxEncodedLength) {
    if (message) message.textContent = messages.tooLarge;
    return;
  }
  // replace, so Back from parlaplay.games does not run the handoff again.
  window.location.replace(importUrl(site, pathname, data));
}

void move();
