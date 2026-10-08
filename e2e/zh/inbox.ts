// The local Supabase's inbox (Mailpit), where sign-in emails land in CI.
const inbox = process.env.SUPABASE_INBOX_URL ?? "http://127.0.0.1:54324";

export const hasSupabase = !!process.env.VITE_SUPABASE_URL;

export function newEmail(): string {
  return `learner-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

type Message = { ID: string; Date: string; Subject: string; Text: string; HTML: string };

// Every email sent to `to`, newest first, waiting up to 15 s for at least `count`.
export async function emailsTo(to: string, count = 1): Promise<Message[]> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${inbox}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages = [] } = (await res.json()) as { messages?: { ID: string }[] };
    if (messages.length >= count) {
      const full = await Promise.all(
        messages.map(
          async (m) => (await (await fetch(`${inbox}/api/v1/message/${m.ID}`)).json()) as Message,
        ),
      );
      return full.sort((x, y) => Date.parse(y.Date) - Date.parse(x.Date));
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email to ${to}`);
}

// How many emails `to` has had so far.
export async function countEmails(to: string): Promise<number> {
  const res = await fetch(`${inbox}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  const { messages = [] } = (await res.json()) as { messages?: unknown[] };
  return messages.length;
}

export function codeIn(message: Message): string {
  const code = /\b(\d{6})\b/.exec(message.Text || message.HTML)?.[1];
  if (!code) throw new Error(`No code in "${message.Subject}"`);
  return code;
}
