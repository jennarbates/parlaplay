import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { requestSignOut, signOutNow } from "../store/account.ts";
import { useAuthStore } from "../store/authStore.ts";
import { useStore } from "zustand";
import { firstCode, languageOf } from "../registry.ts";
import { prefsStore } from "../store/prefs.ts";
import { onBackdropClick } from "./dialog.ts";
import { SignInSheet } from "./SignInSheet.tsx";
import { useIsDesktop } from "./useMediaQuery.ts";
import { homePath, useShell } from "../store/shell.ts";

const levelDetail = {
  1: "ready-made questions with English hints",
  2: "build questions from tiles",
} as const;

// Spec 8.1: the default level, the account (sign in, or sign out with the
// unsynced warning), and the privacy note.
export function Settings() {
  const home = useShell(homePath);
  const { status, email, userId } = useAuthStore();
  // The level of the language last open (platform spec 2: one level per language).
  // One section per language comes with PLAY-029.
  const code = useShell((s) => s.state.language ?? s.recent ?? s.state.lastLanguage) ?? firstCode;
  const language = languageOf(code).englishName;
  const { level, setLevel } = useStore(prefsStore(code));
  const desktop = useIsDesktop();
  const [signingIn, setSigningIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unsynced, setUnsynced] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (unsynced && !d.open) d.showModal();
    if (!unsynced && d.open) d.close();
  }, [unsynced]);

  const signOut = async () => {
    setBusy(true);
    const result = await requestSignOut();
    setBusy(false);
    if (result === "unsynced") setUnsynced(true);
  };

  // The account's text and its button, the same at every size.
  const account =
    status === "signedIn"
      ? {
          text: (
            <p>
              Signed in as <strong>{email}</strong>
            </p>
          ),
          button: (
            <button
              type="button"
              disabled={busy}
              onClick={() => void signOut()}
              className="min-h-12 rounded-xl bg-stone-200 px-5 font-semibold hover:bg-stone-300"
            >
              {busy ? "Syncing…" : "Sign out"}
            </button>
          ),
        }
      : status === "unavailable"
        ? {
            text: (
              <p className="text-stone-600">
                Sign-in isn&apos;t available in this build. You can still play as a guest.
              </p>
            ),
            button: null,
          }
        : {
            text: (
              <p className="text-stone-600">
                You&apos;re playing as a guest. Sign in to keep your progress safe and use it on
                other devices.
              </p>
            ),
            button: (
              <button
                type="button"
                disabled={status === "loading"}
                onClick={() => setSigningIn(true)}
                className="min-h-12 rounded-xl bg-stone-900 px-5 font-semibold text-white hover:bg-stone-700"
              >
                Sign in
              </button>
            ),
          };

  const dialogs = (
    <>
      <SignInSheet open={signingIn} onClose={() => setSigningIn(false)} />
      <dialog
        ref={dialog}
        onCancel={() => setUnsynced(false)}
        onClose={() => setUnsynced(false)}
        onClick={onBackdropClick(() => setUnsynced(false))}
        aria-labelledby="unsynced-title"
        className="m-auto w-[min(90vw,22rem)] rounded-2xl p-5 backdrop:bg-black/50 lg:w-[28rem]"
      >
        <h2 id="unsynced-title" className="text-lg font-semibold">
          Some progress hasn&apos;t synced yet. Sign out anyway?
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Signing out removes your progress from this device. Anything not yet synced will be lost.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => setUnsynced(false)}
            className="min-h-12 rounded-xl bg-stone-200 font-semibold"
          >
            Wait
          </button>
          <button
            type="button"
            onClick={() => {
              setUnsynced(false);
              void signOutNow();
            }}
            className="min-h-12 rounded-xl bg-rose-700 font-semibold text-white"
          >
            Sign out
          </button>
        </div>
      </dialog>
    </>
  );

  // Desktop spec DS 9.4: sections Game, Account and About, each setting a row
  // with its label and description on the left and its control on the right.
  if (desktop) {
    return (
      <section className="flex flex-col gap-8 p-10">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <DesktopSection title="Game">
          <Row
            label={
              <p id="default-level" className="font-medium">
                Default level
              </p>
            }
            description={`The level Play starts at in ${language}.`}
          >
            <div role="radiogroup" aria-labelledby="default-level" className="flex gap-2">
              {([1, 2] as const).map((l) => (
                <label
                  key={l}
                  title={levelDetail[l]}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 ring-2 hover:bg-stone-100 ${
                    level === l ? "ring-stone-900" : "ring-stone-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="default-level"
                    checked={level === l}
                    onChange={() => void setLevel(l, userId)}
                    className="h-5 w-5 accent-stone-900"
                  />
                  Level {l}
                </label>
              ))}
            </div>
          </Row>
        </DesktopSection>
        <DesktopSection title="Account">
          <Row label={<p className="font-medium">Sign-in</p>} description={account.text}>
            {account.button}
          </Row>
        </DesktopSection>
        <DesktopSection title="About">
          <Row
            label={<p className="font-medium">Privacy</p>}
            description="What is stored, who handles it, and how to delete your account."
          >
            <Link
              to="/privacy"
              className="inline-flex min-h-11 items-center text-blue-700 underline"
            >
              Read the privacy note
            </Link>
          </Row>
        </DesktopSection>
        {dialogs}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link
          to={home}
          className="inline-flex min-h-11 min-w-11 items-center text-blue-700 underline"
        >
          Home
        </Link>
      </header>

      <section
        aria-labelledby="account"
        className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200"
      >
        <h2 id="account" className="font-semibold">
          Account
        </h2>
        {account.text}
        {account.button}
      </section>

      <fieldset className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <legend className="float-left mb-1 font-semibold">Default level</legend>
        <p className="text-sm text-stone-600">{language}</p>
        {([1, 2] as const).map((l) => (
          <label key={l} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="default-level"
              checked={level === l}
              onChange={() => void setLevel(l, userId)}
              className="h-5 w-5 accent-stone-900"
            />
            <span>
              Level {l} <span className="text-sm text-stone-600">· {levelDetail[l]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Link
        to="/privacy"
        className="flex min-h-11 items-center rounded-lg bg-white px-4 shadow-sm ring-1 ring-stone-200"
      >
        Privacy
      </Link>
      {dialogs}
    </section>
  );
}

function DesktopSection({ title, children }: { title: string; children: ReactNode }) {
  const id = `settings-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-6 px-5 py-4">
      <div className="flex flex-col gap-1">
        {label}
        <div className="text-sm text-stone-600">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}
