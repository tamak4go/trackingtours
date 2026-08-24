import { describe, expect, it } from "vitest";
import { genSlug, genEditToken, hashToken } from "@/lib/token";

describe("genSlug", () => {
  it("only uses the confusable-free alphabet (no 0/O/1/l/i)", () => {
    for (let i = 0; i < 50; i++) {
      expect(genSlug()).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/);
    }
  });
});

describe("genEditToken", () => {
  it("generates a non-empty, url-safe token that differs between calls", () => {
    const a = genEditToken();
    const b = genEditToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hashToken", () => {
  it("is deterministic for the same input", () => {
    expect(hashToken("same-token")).toBe(hashToken("same-token"));
  });

  it("differs for different inputs", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("never returns the plaintext token", () => {
    expect(hashToken("plaintext")).not.toBe("plaintext");
  });
});
