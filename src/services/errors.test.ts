import type { ErrorEvent } from "@sentry/react";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { scrubBreadcrumb, scrubEvent, scrubUrl } from "./errors.ts";

describe("scrubUrl", () => {
  test.each([
    ["https://shei.parlaplay.games/play?code=123456", "https://shei.parlaplay.games/play"],
    [
      "https://shei.parlaplay.games/#access_token=abc&type=magiclink",
      "https://shei.parlaplay.games/",
    ],
    ["/progress?tab=words#top", "/progress"],
    ["https://x.supabase.co/auth/v1/verify?token=abc#frag", "https://x.supabase.co/auth/v1/verify"],
    [
      "https://shei.parlaplay.games/assets/index-abc.js",
      "https://shei.parlaplay.games/assets/index-abc.js",
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
      url: "https://shei.parlaplay.games/play?code=123456#t",
      method: "GET",
      query_string: "code=123456",
      headers: { Referer: "https://shei.parlaplay.games/?code=1", "User-Agent": "x" },
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
                filename: "https://shei.parlaplay.games/assets/index.js?v=1",
                abs_path: "https://shei.parlaplay.games/assets/index.js?v=1#L1",
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
    expect(scrubbed.request).toEqual({ url: "https://shei.parlaplay.games/play", method: "GET" });
  });

  test("scrubs breadcrumbs and stack frames", () => {
    expect(scrubbed.breadcrumbs?.[0]?.data).toEqual({ from: "/", to: "/play" });
    expect(scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
      filename: "https://shei.parlaplay.games/assets/index.js",
      abs_path: "https://shei.parlaplay.games/assets/index.js",
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
