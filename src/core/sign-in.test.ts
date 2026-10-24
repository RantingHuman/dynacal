import { describe, expect, it } from "vitest";
import { createTestApp } from "./testing";

const OWNER = "owner@example.com";

describe("sign-in", () => {
  it("lets the owner sign in and starts a session", () => {
    const { commands } = createTestApp({ ownerEmail: OWNER });

    const result = commands.signIn({ email: OWNER, emailVerified: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(commands.getSession(result.sessionId)).toEqual({ email: OWNER });
  });

  it("refuses any other Google account", () => {
    const { commands } = createTestApp({ ownerEmail: OWNER });

    const result = commands.signIn({ email: "stranger@example.com", emailVerified: true });

    expect(result).toEqual({ ok: false, reason: "not-owner" });
  });

  it("refuses the owner's email when Google hasn't verified it", () => {
    const { commands } = createTestApp({ ownerEmail: OWNER });

    const result = commands.signIn({ email: OWNER, emailVerified: false });

    expect(result).toEqual({ ok: false, reason: "email-unverified" });
  });

  it("matches the owner's email regardless of case", () => {
    const { commands } = createTestApp({ ownerEmail: "Owner@Example.com" });

    expect(commands.signIn({ email: "owner@example.COM", emailVerified: true }).ok).toBe(true);
  });

  it("ends the session after 30 days", () => {
    const { commands, clock } = createTestApp({ ownerEmail: OWNER });
    const result = commands.signIn({ email: OWNER, emailVerified: true });
    if (!result.ok) throw new Error("sign-in failed");

    clock.advance(30 * 24 * 60 * 60 * 1000 - 1);
    expect(commands.getSession(result.sessionId)).not.toBeNull();
    clock.advance(1);
    expect(commands.getSession(result.sessionId)).toBeNull();
  });

  it("ends the session on sign-out", () => {
    const { commands } = createTestApp({ ownerEmail: OWNER });
    const result = commands.signIn({ email: OWNER, emailVerified: true });
    if (!result.ok) throw new Error("sign-in failed");

    commands.signOut(result.sessionId);

    expect(commands.getSession(result.sessionId)).toBeNull();
  });
});
