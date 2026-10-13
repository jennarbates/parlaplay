import type { ErrorEvent } from "@sentry/react";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { languageTag, scrubBreadcrumb, scrubEvent, scrubUrl, tagLanguage } from "./errors.ts";

describe("scrubUrl", () => {
  test.each([
    ["https://chie.parlaplay.games/play?code=123456", "https://chie.parlaplay.games/play"],
    [
      "https://chie.parlaplay.games/#access_token=abc&type=magiclink",
      "https://chie.parlaplay.games/",
    ],
    ["/progress?tab=words#top", "/progress"],
    ["https://x.supabase.co/auth/v1/verify?token=abc#frag", "https://x.supabase.co/auth/v1/verify"],
    [
      "https://chie.parlaplay.games/assets/index-abc.js",
      "https://chie.parlaplay.games/assets/index-abc.js",
    ],
    ["", ""],
  ])("%s", (url, expected) => {
    expect(scrubUrl(url)).toBe(expected);
  });

  test("never leaves a ? or # behind", () => {
    fc.assert(
      fc.property(fc.webUrl({ withQueryParameters: true, withFragments: true }), (url) => {
        const scrubbed = scrubUrl(url);
        expect(scrubbed).not.toMatch(/[?#]/);
        expect(url.startsWith(scrubbed)).toBe(true);
      }),
    );
  });

  test("handles newlines in the query", () => {
    expect(scrubUrl("/play?a=1\nb=2")).toBe("/play");
  });
});

describe("scrubBreadcrumb", () => {
  test("navigation from and to", () => {
    expect(
      scrubBreadcrumb({ category: "navigation", data: { from: "/?code=1", to: "/play#x" } }),
    ).toEqual({ category: "navigation", data: { from: "/", to: "/play" } });
  });

  test("fetch url, other data kept", () => {
    expect(
      scrubBreadcrumb({
        category: "fetch",
        data: {
          url: "https://x.supabase.co/rest/v1/games?select=*",
          method: "GET",
          status_code: 200,
        },
      }),
    ).toEqual({
      category: "fetch",
      data: { url: "https://x.supabase.co/rest/v1/games", method: "GET", status_code: 200 },
    });
  });

  test("breadcrumbs without data pass through", () => {
    expect(scrubBreadcrumb({ category: "console", message: "hi" })).toEqual({
      category: "console",
      message: "hi",
    });
  });

  test("does not mutate the original", () => {
    const original = { data: { url: "/a?b" } };
    scrubBreadcrumb(original);
    expect(original.data.url).toBe("/a?b");
  });
});

describe("scrubEvent", () => {
  const event: ErrorEvent = {
    type: undefined,
    user: { email: "learner@example.com", ip_address: "{{auto}}", id: "u1" },
    request: {
      url: "https://chie.parlaplay.games/play?code=123456#t",
      method: "GET",
      query_string: "code=123456",
      headers: { Referer: "https://chie.parlaplay.games/?code=1", "User-Agent": "x" },
      cookies: { sb: "token" },
    },
    breadcrumbs: [{ category: "navigation", data: { from: "/?code=1", to: "/play" } }],
    exception: {
      values: [
        {
          type: "Error",
          value: "boom",
          stacktrace: {
            frames: [
              {
                filename: "https://chie.parlaplay.games/assets/index.js?v=1",
                abs_path: "https://chie.parlaplay.games/assets/index.js?v=1#L1",
                lineno: 1,
              },
            ],
          },
        },
      ],
    },
  };

  const scrubbed = scrubEvent(event);

  test("drops the user entirely", () => {
    expect(scrubbed.user).toBeUndefined();
  });

  test("keeps only a scrubbed url and the method from the request", () => {
    expect(scrubbed.request).toEqual({ url: "https://chie.parlaplay.games/play", method: "GET" });
  });

  test("scrubs breadcrumbs and stack frames", () => {
    expect(scrubbed.breadcrumbs?.[0]?.data).toEqual({ from: "/", to: "/play" });
    expect(scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
      filename: "https://chie.parlaplay.games/assets/index.js",
      abs_path: "https://chie.parlaplay.games/assets/index.js",
      lineno: 1,
    });
  });

  test("nothing personal survives anywhere in the event", () => {
    const json = JSON.stringify(scrubbed);
    for (const secret of ["learner@example.com", "123456", "code=", "token", "?", "#"]) {
      expect(json).not.toContain(secret);
    }
  });

  test("does not mutate the original", () => {
    expect(event.user?.email).toBe("learner@example.com");
    expect(event.request?.url).toContain("?code=");
  });
});

// Platform spec 9, D18: every event is tagged it, zh or none.
describe("the language tag", () => {
  test.each([
    ["https://parlaplay.games/it", "it"],
    ["https://parlaplay.games/it/play?seed=1", "it"],
    ["https://parlaplay.games/zh/progress", "zh"],
    ["https://parlaplay.games/languages", "none"],
    ["https://parlaplay.games/settings", "none"],
    ["https://parlaplay.games/import#data=abc&next=/it/play", "none"],
    ["https://parlaplay.games/fr/play", "none"],
    ["https://parlaplay.games/", "none"],
    ["/zh/play", "zh"],
    ["not a url at all ://", "none"],
    [undefined, "none"],
  ])("%s is tagged %s", (url, tag) => {
    expect(languageTag(url)).toBe(tag);
  });

  test("is added beside the event's other tags, from its own url", () => {
    const event: ErrorEvent = {
      type: undefined,
      tags: { handled: "no" },
      request: { url: "https://parlaplay.games/zh/play?seed=1" },
    };
    expect(tagLanguage(event).tags).toEqual({ handled: "no", language: "zh" });
    expect(event.tags).toEqual({ handled: "no" }); // not mutated
  });

  test("falls back to the url given when the event has none", () => {
    const event: ErrorEvent = { type: undefined };
    expect(tagLanguage(event, "https://parlaplay.games/it/progress").tags?.language).toBe("it");
    expect(tagLanguage(event).tags?.language).toBe("none");
  });

  test("an /import error keeps its tag and loses the handoff data", () => {
    const event: ErrorEvent = {
      type: undefined,
      request: { url: "https://parlaplay.games/import#data=SECRETDATA&next=/it/play" },
    };
    const sent = scrubEvent(tagLanguage(event));
    expect(sent.tags?.language).toBe("none");
    expect(JSON.stringify(sent)).not.toContain("SECRETDATA");
  });
});
