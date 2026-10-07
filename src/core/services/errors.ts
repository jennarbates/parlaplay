// Spec 9, D19: Sentry for errors only. No replay, no tracing, no personal data,
// and no query strings or hashes in any URL that leaves the browser.
import * as Sentry from "@sentry/react";
import type { Breadcrumb, ErrorEvent } from "@sentry/react";

// Everything after the path: query strings carry codes and tokens, hashes carry
// Supabase auth sessions.
export function scrubUrl(url: string): string {
  return url.replace(/[?#].*$/s, "");
}

const urlKeys = ["url", "from", "to"] as const;

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const data = breadcrumb.data && { ...breadcrumb.data };
  if (data) {
    for (const key of urlKeys) {
      if (typeof data[key] === "string") data[key] = scrubUrl(data[key]);
    }
  }
  return { ...breadcrumb, ...(data && { data }) };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event };
  delete scrubbed.user;

  if (event.request) {
    const { url, method } = event.request;
    scrubbed.request = { ...(url && { url: scrubUrl(url) }), ...(method && { method }) };
  }
  if (event.breadcrumbs) scrubbed.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  if (event.exception?.values) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map((value) => ({
        ...value,
        ...(value.stacktrace?.frames && {
          stacktrace: {
            ...value.stacktrace,
            frames: value.stacktrace.frames.map((frame) => ({
              ...frame,
              ...(frame.filename && { filename: scrubUrl(frame.filename) }),
              ...(frame.abs_path && { abs_path: scrubUrl(frame.abs_path) }),
            })),
          },
        }),
      })),
    };
  }
  return scrubbed;
}

export function initErrors(env: ImportMetaEnv = import.meta.env): boolean {
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    release: env.VITE_RELEASE,
    environment: env.VITE_ENVIRONMENT ?? "development",
    // Sentry 11's replacement for sendDefaultPii: false.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    // No tracesSampleRate and no replay or tracing integrations: errors only. Session
    // tracking is a default that pings on every page load, so it goes too.
    integrations: (defaults) => defaults.filter((i) => i.name !== "BrowserSession"),
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
  return true;
}
