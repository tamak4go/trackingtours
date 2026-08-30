// Thin wrapper around the Gemini API for generating a structured, per-stop
// Vietnamese trip narrative from a trip's route stats + photos. See
// docs/gemini-story-setup.md for how to get a free API key. Mirrors the
// hand-rolled-client style of src/lib/tiktok.ts rather than pulling in the
// full @google/genai SDK. Schema/tone/model-fallback design ported from the
// companion Google AI Studio app (docs/ai-studio-build-spec.md), which
// proved a richer, more reliable prompt than this file's first version.

import { STORY_TONES, type StoryTone, type TripStory } from "./story-types";

const GENERATE_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Tried in order, falling through to the next on any error (network hiccup,
// 503 overloaded, 429 rate limit, or a deprecated/unavailable model).
// gemini-2.5-flash and gemini-2.5-flash-lite were confirmed working via
// curl during initial setup but later started 404ing with "no longer
// available to new users" -- Gemini model availability shifts over time,
// so this list is verified against a live curl test each time it's
// touched, not assumed from memory. Verified working as of 2026-08-30:
// gemini-3.6-flash and gemini-3.1-flash-lite (200); gemini-flash-latest and
// gemini-3.7-flash were 503/overloaded at that moment but kept as
// fallbacks since that's transient, not a removal.
const CANDIDATE_MODELS = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.7-flash"];

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type StoryInput = {
  title: string;
  distanceKm: number;
  durationMs: number;
  placeNames: string[];
  // Already sampled + in the trip's real chronological order (from GPS
  // EXIF) by the caller -- unlike the AI Studio companion app, this app
  // already knows the correct order, so Gemini isn't asked to guess it.
  photos: { url: string; placeName: string | null }[];
  tone: StoryTone;
};

// The public Gemini Developer API only accepts image bytes inline (base64)
// or via its own Files API -- not arbitrary external URLs -- so photos are
// fetched here and inlined.
async function toInlineImagePart(url: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    return { inlineData: { mimeType, data: buf.toString("base64") } };
  } catch {
    return null;
  }
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tripTitle: { type: "STRING", description: "Tiêu đề chuyến đi thật kêu và chất phượt." },
    summary: { type: "STRING", description: "Đoạn văn mở đầu tóm tắt linh hồn và cảm xúc của chuyến đi (2-3 câu)." },
    estimatedStats: {
      type: "OBJECT",
      properties: {
        terrainTypes: { type: "ARRAY", items: { type: "STRING" }, description: "Các loại địa hình nhận diện được qua ảnh." },
        vibeScore: { type: "STRING", description: "Độ 'bụi' và trải nghiệm của chuyến đi, vd '9/10 - Bụi bặm & Chill hết nấc'." },
        weatherVibe: { type: "STRING", description: "Thời tiết tổng quan chuyến đi." },
      },
      required: ["terrainTypes", "vibeScore", "weatherVibe"],
    },
    timeline: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          photoIndex: { type: "INTEGER", description: "Chỉ số 0-based của ảnh tương ứng, đúng theo thứ tự ảnh đã gửi -- không đổi thứ tự." },
          timeOfDay: { type: "STRING", description: "Khung giờ ước tính hoặc thời điểm trong ngày." },
          stopTitle: { type: "STRING", description: "Tiêu đề ngắn cho điểm dừng này." },
          locationGuess: { type: "STRING", description: "Địa danh hoặc bối cảnh đoán được từ ảnh." },
          story: { type: "STRING", description: "Đoạn văn tự sự kể chuyện sống động về khoảnh khắc này (3-5 câu)." },
          mood: { type: "STRING", description: "Cảm xúc nổi bật tại điểm dừng." },
          highlightQuote: { type: "STRING", description: "Một câu cảm thán hoặc châm ngôn phượt ngắn gọn cho điểm dừng này." },
        },
        required: ["photoIndex", "timeOfDay", "stopTitle", "locationGuess", "story", "mood", "highlightQuote"],
      },
    },
    conclusion: { type: "STRING", description: "Lời kết hành trình đọng lại cảm xúc (2-3 câu)." },
  },
  required: ["tripTitle", "summary", "estimatedStats", "timeline", "conclusion"],
};

export async function generateTripStory(input: StoryInput): Promise<TripStory> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY env var -- see docs/gemini-story-setup.md");

  const hours = (input.durationMs / 3_600_000).toFixed(1);
  const places = input.placeNames.filter(Boolean).join(", ") || "không rõ địa danh cụ thể";
  const toneInstruction = STORY_TONES[input.tone].instruction;

  const inlineImages = await Promise.all(input.photos.map((p) => toInlineImagePart(p.url)));
  const imageParts: unknown[] = [];
  inlineImages.forEach((part, i) => {
    if (!part) return;
    const placeName = input.photos[i].placeName;
    imageParts.push({ text: `\n--- [Ảnh #${i}]${placeName ? ` (${placeName})` : ""} ---` });
    imageParts.push(part);
  });

  const promptText = `Bạn là một phượt thủ xe máy kỳ cựu tại Việt Nam với ngòi bút kể chuyện sống động, chân thực. Dựa trên ${input.photos.length} ảnh chuyến đi dưới đây (đã đúng thứ tự thời gian thật), hãy viết một cuốn "Nhật ký hành trình" chia theo từng điểm dừng.

${toneInstruction}

Thông tin chuyến đi:
- Tên: ${input.title}
- Quãng đường: ${input.distanceKm.toFixed(1)} km
- Thời gian: ${hours} giờ
- Địa danh đi qua: ${places}

Với mỗi ảnh, viết một điểm dừng trong "timeline" có "photoIndex" đúng bằng chỉ số ảnh (0 đến ${input.photos.length - 1}) theo đúng thứ tự đã gửi -- không đổi thứ tự. Trả lời hoàn toàn bằng tiếng Việt, đậm chất văn hoá phượt.`;

  let lastError: unknown = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await fetch(`${GENERATE_URL_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }, ...imageParts] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Gemini API (${model}) lỗi ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (!text) throw new Error("Gemini không trả về nội dung.");

      const parsed = JSON.parse(text) as Omit<TripStory, "tone">;
      return { ...parsed, tone: input.tone };
    } catch (err) {
      lastError = err; // try the next candidate model
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini không phản hồi sau nhiều lần thử.");
}
