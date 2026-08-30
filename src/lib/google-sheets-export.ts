// Exports a trip's photo log (place, lat/lng, thời gian chụp) to a new
// Google Sheet, using the viewer's own Google account via Google Identity
// Services (client-side OAuth popup) -- no server-side Workspace
// credentials, no billing. See docs/google-sheets-export-setup.md for how
// to get a free OAuth Client ID.

const GIS_SRC = "https://accounts.google.com/gsi/client";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export function googleSheetsExportConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID);
}

let gisLoaded: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("client-only"));
  if ((window as unknown as { google?: unknown }).google) return Promise.resolve();
  if (!gisLoaded) {
    gisLoaded = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Không tải được Google Identity Services."));
      document.head.appendChild(script);
    });
  }
  return gisLoaded;
}

type TokenClient = { requestAccessToken: (opts?: { prompt?: string }) => void };
type GoogleAccounts = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (resp: { access_token?: string; error?: string }) => void;
      }) => TokenClient;
    };
  };
};

function getAccessToken(clientId: string): Promise<string> {
  return loadGis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const google = (window as unknown as { google: GoogleAccounts }).google;
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SHEETS_SCOPE,
          callback: (resp) => {
            if (resp.access_token) resolve(resp.access_token);
            else reject(new Error(resp.error || "Từ chối quyền truy cập Google Sheets."));
          },
        });
        client.requestAccessToken({ prompt: "" });
      }),
  );
}

export type PhotoLogRow = { placeName: string; lat: number; lng: number; takenAt: string | null };

export async function exportTripToGoogleSheets(title: string, photos: PhotoLogRow[]): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("Chưa cấu hình Google OAuth Client ID.");

  const accessToken = await getAccessToken(clientId);
  const authHeaders = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ properties: { title: `${title} — Tracking Phượt` } }),
  });
  if (!createRes.ok) throw new Error("Tạo Google Sheet thất bại.");
  const created = (await createRes.json()) as { spreadsheetId: string; spreadsheetUrl: string };

  const rows = [
    ["Địa danh", "Vĩ độ", "Kinh độ", "Thời gian chụp"],
    ...photos.map((p) => [p.placeName || "", p.lat, p.lng, p.takenAt || ""]),
  ];
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
    { method: "POST", headers: authHeaders, body: JSON.stringify({ values: rows }) },
  );
  if (!updateRes.ok) throw new Error("Ghi dữ liệu vào Google Sheet thất bại.");

  return created.spreadsheetUrl;
}
