// Spec 7: the Supabase client, with the public (publishable) key only. Without
// the env vars (a local build with no Supabase running) the app still works as a
// guest; sign-in says it is unavailable.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export let supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

// Sync tests against the local Supabase: run the app's code as a test user.
export function setClientForTests(client: SupabaseClient | null) {
  supabase = client;
}
