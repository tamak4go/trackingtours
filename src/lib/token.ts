import { randomBytes, createHash } from "crypto";
import { customAlphabet } from "nanoid";

const slugAlphabet = "23456789abcdefghjkmnpqrstuvwxyz"; // no 0/O/1/l/i, avoids confusable share links
export const genSlug = customAlphabet(slugAlphabet, 10);

export function genEditToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
