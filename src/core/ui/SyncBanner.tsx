import { useSyncStore } from "../services/sync.ts";

// Spec 8.2: when a signed-in sync fails, a small banner says the data is safe on
// this device. It never blocks play; the next flush clears it.
export function SyncBanner() {
  const show = useSyncStore((s) => s.status === "failed" && s.outbox.length > 0);
  if (!show) return null;
  return (
    <p role="status" className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-950">
      Saved on this device, will sync later.
    </p>
  );
}
