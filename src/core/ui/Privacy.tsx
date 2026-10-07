import { Link } from "react-router";

// Where account deletion requests go (spec 7.3). The mailbox must exist before launch.
const privacyEmail = "privacy@parlaplay.games";

// Spec 7.3 and 9 (Privacy): what is stored, who processes it, that Safari can clear
// guest data, and how to get an account deleted.
export function Privacy() {
  return (
    // Desktop spec DS 9.5: one reading column at lg, larger, with a way back to
    // Settings (DesktopNav has Home).
    <article className="flex flex-col gap-5 p-4 leading-relaxed lg:mx-auto lg:max-w-prose lg:px-0 lg:py-10 lg:text-lg">
      <Link
        to="/settings"
        className="hidden min-h-11 items-center self-start text-blue-700 underline lg:inline-flex"
      >
        <span aria-hidden="true">←&nbsp;</span>Back to Settings
      </Link>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold lg:text-4xl">Privacy</h1>
        <Link
          to="/"
          className="inline-flex min-h-11 min-w-11 items-center text-blue-700 underline lg:hidden"
        >
          Home
        </Link>
      </header>

      <section aria-labelledby="guests">
        <h2 id="guests" className="mb-1 font-semibold">
          Playing as a guest
        </h2>
        <p>
          Your games and progress stay on this device, in your browser&apos;s storage. Nothing is
          sent to us. There are no analytics and no trackers.
        </p>
        <p className="mt-2">
          Your browser can delete this data. Safari on iPhone and iPad clears a site&apos;s storage
          after 7 days of using Safari without visiting it. To keep your progress safe, sign in.
        </p>
      </section>

      <section aria-labelledby="accounts">
        <h2 id="accounts" className="mb-1 font-semibold">
          With an account
        </h2>
        <p>
          We store your email address, your profile (your default level), the rounds you play, a log
          of the words you practised and how each went, and your review schedule. That is all.
        </p>
      </section>

      <section aria-labelledby="services">
        <h2 id="services" className="mb-1 font-semibold">
          Services that handle data
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            <strong>Supabase</strong>: our database and sign-in. Stores everything listed under
            &ldquo;With an account&rdquo;.
          </li>
          <li>
            <strong>Cloudflare</strong>: hosts the app. Sees every visitor&apos;s IP address and
            requests, guests included.
          </li>
          <li>
            <strong>Amazon SES</strong> (or <strong>Resend</strong> as a backup): sends the sign-in
            email. Sees your email address.
          </li>
          <li>
            <strong>Sentry</strong>: error reports when something breaks. Personal data is removed
            before a report is sent: no email, no IP address stored, and no parts of web addresses
            that could identify you.
          </li>
        </ul>
      </section>

      <section aria-labelledby="deletion">
        <h2 id="deletion" className="mb-1 font-semibold">
          Deleting your account
        </h2>
        <p>
          There is no delete button in the app yet. Email{" "}
          <a
            href={`mailto:${privacyEmail}`}
            className="inline-flex min-h-11 items-center text-blue-700 underline"
          >
            {privacyEmail}
          </a>{" "}
          from the address you signed in with, and we will delete your account and everything stored
          with it within one month.
        </p>
      </section>
    </article>
  );
}
