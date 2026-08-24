// Client-side integration with the Google Photos Picker API -- the only
// sanctioned way (since the Library API's photoslibrary.readonly scope was
// removed in March 2025) for an app to let a user select from their whole
// Google Photos library rather than just what the app itself uploaded.
//
// Google deliberately omits GPS from the API's own JSON metadata for every
// picked item (privacy policy, not a bug) -- but downloading a picked item's
// *original bytes* via its baseUrl still returns the file with its EXIF
// intact (GPS included), as long as it was backed up at "Original quality".
// So this module only fetches raw bytes and wraps them as File objects; GPS
// extraction still goes through the exact same parsePhotoExif() pipeline
// every other upload path uses -- no separate code path, no trusting
// anything Google's API claims about location.
const API_BASE = "https://photospicker.googleapis.com/v1";

type PickerSession = {
  id: string;
  pickerUri: string;
  pollingConfig: { pollInterval: string; timeoutIn: string };
  mediaItemsSet: boolean;
};

type PickedMediaItem = {
  id: string;
  createTime: string;
  mediaFile: { baseUrl: string; mimeType: string; filename: string };
};

function cookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getGoogleProviderToken(): string | null {
  return cookie("google_provider_token");
}

async function authedFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Phiên Google đã hết hạn, hãy đăng nhập lại để nhập ảnh.");
    throw new Error(`Google Photos API lỗi ${res.status}`);
  }
  return res;
}

function parseDurationSeconds(iso: string): number {
  // pollingConfig durations come back as e.g. "5s" -- not a full ISO 8601
  // duration, just a plain number-plus-"s" per the API's own examples.
  const n = parseFloat(iso);
  return Number.isFinite(n) ? n : 5;
}

async function createSession(token: string): Promise<PickerSession> {
  const res = await authedFetch(`${API_BASE}/sessions`, token, { method: "POST" });
  return res.json();
}

async function pollSession(id: string, token: string, pollIntervalS: number, timeoutS: number): Promise<PickerSession> {
  const deadline = Date.now() + timeoutS * 1000;
  while (Date.now() < deadline) {
    const res = await authedFetch(`${API_BASE}/sessions/${id}`, token);
    const session: PickerSession = await res.json();
    if (session.mediaItemsSet) return session;
    await new Promise((r) => setTimeout(r, pollIntervalS * 1000));
  }
  throw new Error("Hết thời gian chờ chọn ảnh trên Google Photos.");
}

async function listMediaItems(sessionId: string, token: string): Promise<PickedMediaItem[]> {
  const items: PickedMediaItem[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${API_BASE}/mediaItems`);
    url.searchParams.set("sessionId", sessionId);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await authedFetch(url.toString(), token);
    const data = await res.json();
    items.push(...(data.mediaItems ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

async function downloadOriginal(item: PickedMediaItem, token: string): Promise<File> {
  // "=d" requests the original bytes (not a resized/re-encoded preview) --
  // this is what preserves EXIF, per Google's own base URL docs.
  const res = await authedFetch(`${item.mediaFile.baseUrl}=d`, token);
  const blob = await res.blob();
  return new File([blob], item.mediaFile.filename, { type: item.mediaFile.mimeType });
}

async function deleteSession(id: string, token: string) {
  try {
    await authedFetch(`${API_BASE}/sessions/${id}`, token, { method: "DELETE" });
  } catch {
    // best-effort cleanup only, the session expires on its own regardless
  }
}

// Opens Google's photo picker in a new tab, waits for the user to finish
// selecting, then downloads the original bytes of everything they picked.
// `onPickerOpened` is called with the picker URL as soon as it's known, so
// the caller can open it (must happen from the original click handler to
// avoid popup blockers).
export async function pickFromGooglePhotos(
  token: string,
  onPickerOpened: (pickerUri: string) => void,
  onProgress?: (done: number, total: number) => void,
): Promise<File[]> {
  const session = await createSession(token);
  onPickerOpened(session.pickerUri);

  const finished = await pollSession(
    session.id,
    token,
    parseDurationSeconds(session.pollingConfig.pollInterval),
    parseDurationSeconds(session.pollingConfig.timeoutIn),
  );

  const items = await listMediaItems(finished.id, token);
  onProgress?.(0, items.length);
  const files: File[] = [];
  for (const item of items) {
    files.push(await downloadOriginal(item, token));
    onProgress?.(files.length, items.length);
  }

  await deleteSession(finished.id, token);
  return files;
}
