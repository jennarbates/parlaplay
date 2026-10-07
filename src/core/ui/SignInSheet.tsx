import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthStore } from "../store/authStore.ts";
import { onBackdropClick } from "./dialog.ts";

// Seconds before "Resend code" works. Supabase's default rate limit for sign-in
// emails is 60 s; the local Supabase used in tests allows a lower value.
const cooldown = Number(import.meta.env.VITE_OTP_COOLDOWN_S ?? 60);

type Step = { kind: "email" } | { kind: "code"; email: string; sentAt: number };

// Spec 7.3 and 8.1: an email field, then a 6-digit code field with "Resend
// code". Errors from spec 8.2 show inline: a wrong or expired code, and an email
// that failed to send.
export function SignInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { sendCode, verifyCode } = useAuthStore();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Tick once a second while waiting to offer "Resend code".
  useEffect(() => {
    if (step.kind !== "code") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const send = async (to: string) => {
    setBusy(true);
    setError(undefined);
    const result = await sendCode(to);
    setBusy(false);
    if (result.ok) {
      setStep({ kind: "code", email: to, sentAt: Date.now() });
      setNow(Date.now());
      setCode("");
    } else if (result.error === "rate") {
      setError(`Please wait ${result.retryInSeconds} seconds before asking for another code.`);
    } else {
      setError(
        "We couldn't send the email. Check the address and your connection, then try again.",
      );
    }
  };

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    void send(email.trim());
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (step.kind !== "code") return;
    setBusy(true);
    setError(undefined);
    const result = await verifyCode(step.email, code.trim());
    setBusy(false);
    if (result.ok) {
      setStep({ kind: "email" });
      onClose();
    } else if (result.error === "code") {
      setError("That code is wrong or has expired. Check it, or send a new one.");
    } else {
      setError("Something went wrong. Check your connection and try again.");
    }
  };

  const waitLeft =
    step.kind === "code" ? Math.max(0, Math.ceil(cooldown - (now - step.sentAt) / 1000)) : 0;
  const field = "min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-lg";
  const primary =
    "min-h-12 w-full rounded-xl bg-stone-900 font-semibold text-white disabled:opacity-50";

  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      onClick={onBackdropClick(onClose)}
      aria-labelledby="sign-in-title"
      // A bottom sheet on the phone; a centred modal at lg (desktop spec DS 9.6).
      className="mx-auto mt-auto mb-0 w-full max-w-md rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop:bg-black/50 lg:m-auto lg:w-[28rem] lg:rounded-2xl lg:pb-5"
    >
      <div className="flex items-center justify-between">
        <h2 id="sign-in-title" className="text-xl font-semibold">
          Sign in
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center text-xl"
        >
          ×
        </button>
      </div>

      {step.kind === "email" ? (
        <form onSubmit={submitEmail} className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-stone-600">
            We&apos;ll email you a 6-digit code. No password needed.
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={primary}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-stone-600">
            We sent a code to <strong>{step.email}</strong>. Type it here; don&apos;t close this
            tab.
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-medium">6-digit code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${field} tracking-[0.4em]`}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || code.length !== 6} className={primary}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              disabled={busy || waitLeft > 0}
              onClick={() => void send(step.email)}
              className="min-h-11 text-sm text-blue-700 underline disabled:text-stone-600 disabled:no-underline"
            >
              {waitLeft > 0 ? `Resend code in ${waitLeft} s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep({ kind: "email" });
                setError(undefined);
              }}
              className="min-h-11 text-sm text-blue-700 underline"
            >
              Use a different email
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
