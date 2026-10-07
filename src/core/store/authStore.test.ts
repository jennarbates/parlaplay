import { beforeEach, describe, expect, test, vi } from "vitest";

// A fake Supabase auth client, so the store's handling of each outcome is tested
// without a server. The real thing is covered by e2e/sign-in.spec.ts in CI.
const auth = {
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("../services/supabase.ts", () => ({ supabase: { auth } }));
const { useAuthStore } = await import("./authStore.ts");

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ status: "loading", userId: null, email: null });
});

describe("sendCode", () => {
  test("asks Supabase for an email code, creating the user if new", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null });
    expect(await useAuthStore.getState().sendCode("a@b.co")).toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "a@b.co",
      options: { shouldCreateUser: true },
    });
  });

  test("a rate limit says how long to wait", async () => {
    auth.signInWithOtp.mockResolvedValue({
      error: {
        status: 429,
        message: "For security purposes, you can only request this after 42 seconds.",
      },
    });
    expect(await useAuthStore.getState().sendCode("a@b.co")).toEqual({
      ok: false,
      error: "rate",
      retryInSeconds: 42,
    });
  });

  test("any other failure is a send error", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { status: 500, message: "SMTP down" } });
    expect(await useAuthStore.getState().sendCode("a@b.co")).toEqual({ ok: false, error: "send" });
  });
});

describe("verifyCode", () => {
  test("checks the code as an email OTP", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    expect(await useAuthStore.getState().verifyCode("a@b.co", "123456")).toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: "a@b.co",
      token: "123456",
      type: "email",
    });
  });

  test("a 4xx is a wrong or expired code; a 5xx or no status is the network", async () => {
    auth.verifyOtp.mockResolvedValue({
      error: { status: 403, message: "Token has expired or is invalid" },
    });
    expect(await useAuthStore.getState().verifyCode("a@b.co", "000000")).toEqual({
      ok: false,
      error: "code",
    });
    auth.verifyOtp.mockResolvedValue({ error: { status: 503, message: "down" } });
    expect(await useAuthStore.getState().verifyCode("a@b.co", "000000")).toEqual({
      ok: false,
      error: "network",
    });
  });
});

describe("init", () => {
  test("a stored session means signed in; auth changes are followed", async () => {
    let listener: ((event: string, session: unknown) => void) | undefined;
    auth.onAuthStateChange.mockImplementation((cb) => {
      listener = cb;
      return { data: { subscription: { unsubscribe() {} } } };
    });
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "u1", email: "a@b.co" } } },
    });
    await useAuthStore.getState().init();
    expect(useAuthStore.getState()).toMatchObject({
      status: "signedIn",
      userId: "u1",
      email: "a@b.co",
    });
    listener?.("SIGNED_OUT", null);
    expect(useAuthStore.getState()).toMatchObject({ status: "guest", userId: null, email: null });
  });
});
