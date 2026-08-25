import { randomBytes } from "crypto";

// Thin wrapper around TikTok's OAuth + Content Posting API (v2). See
// docs/tiktok-setup.md for how to get a client key/secret and what an
// unaudited app can and can't do (spoiler: posts land in the user's TikTok
// inbox as a draft, not directly on their profile, until TikTok reviews the
// app -- see the CAVEAT comment on uploadToInbox below).

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const INBOX_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";

export const TIKTOK_COOKIE = {
  access: "tiktok_access_token",
  refresh: "tiktok_refresh_token",
  expiresAt: "tiktok_expires_at",
  openId: "tiktok_open_id",
  state: "tiktok_oauth_state",
  returnTo: "tiktok_return_to",
} as const;

export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} env var -- see docs/tiktok-setup.md`);
  return v;
}

export function tiktokRedirectUri(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/api/tiktok/callback`;
}

export function genOAuthState(): string {
  return randomBytes(16).toString("base64url");
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: requireEnv("TIKTOK_CLIENT_KEY"),
    // video.publish is the scope gating the Content Posting API (init/upload
    // endpoints below); user.info.basic just lets us show "Đã kết nối" with
    // no extra call. Both must be enabled on the TikTok app, or TikTok
    // rejects the whole authorize request up front.
    scope: "user.info.basic,video.publish",
    response_type: "code",
    redirect_uri: tiktokRedirectUri(),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  open_id: string;
  error?: string;
  error_description?: string;
};

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: requireEnv("TIKTOK_CLIENT_KEY"),
      client_secret: requireEnv("TIKTOK_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: tiktokRedirectUri(),
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) throw new Error(data.error_description || `TikTok token exchange failed (${res.status})`);
  return data;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: requireEnv("TIKTOK_CLIENT_KEY"),
      client_secret: requireEnv("TIKTOK_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) throw new Error(data.error_description || `TikTok token refresh failed (${res.status})`);
  return data;
}

// CAVEAT: this posts to the user's TikTok inbox (Nháp/draft), the only
// posting mode TikTok allows an app to use before it passes their manual
// audit for the "Direct Post" product. The user still has to open the
// TikTok app and tap Đăng to actually publish it -- there is no way around
// that from an unaudited app, see docs/tiktok-setup.md.
export async function uploadToInbox(
  accessToken: string,
  video: Buffer,
  opts: { title: string },
): Promise<{ publishId: string }> {
  const initRes = await fetch(INBOX_INIT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      post_info: { title: opts.title },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: video.byteLength,
        chunk_size: video.byteLength,
        total_chunk_count: 1,
      },
    }),
  });
  const initData = await initRes.json();
  if (!initRes.ok || initData.error?.code !== "ok") {
    throw new Error(initData.error?.message || `TikTok upload init failed (${initRes.status})`);
  }

  const uploadUrl: string = initData.data.upload_url;
  const publishId: string = initData.data.publish_id;

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(video.byteLength),
      "Content-Range": `bytes 0-${video.byteLength - 1}/${video.byteLength}`,
    },
    body: new Uint8Array(video),
  });
  if (!putRes.ok) throw new Error(`TikTok video upload failed (${putRes.status})`);

  return { publishId };
}
