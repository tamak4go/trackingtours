// Shared types/constants for the AI-generated trip story (see
// src/lib/gemini.ts for generation, TripView.tsx for display). Kept in its
// own file with zero env/server access so client components can import
// STORY_TONES (a value, used for the tone-picker UI) without pulling
// gemini.ts's server-only code into the client bundle.

export const STORY_TONES = {
  enthusiastic: {
    label: "Nhiệt huyết",
    instruction:
      "Giọng văn nhiệt huyết, tự do, phóng khoáng, hừng hực tinh thần tuổi trẻ 'xách xe lên và đi', cảm giác tự do khi chinh phục cung đường.",
  },
  humorous: {
    label: "Hài hước",
    instruction:
      "Giọng văn hài hước, dí dỏm, tếu táo, đậm chất 'dân phượt lầy lội', lạc quan dù mưa gió hay trục trặc dọc đường.",
  },
  poetic: {
    label: "Trầm lắng",
    instruction:
      "Giọng văn trầm lắng, giàu chất thơ, chiêm nghiệm về tuổi trẻ, những cung đường vắng và sự tĩnh lặng của thiên nhiên.",
  },
  detailed: {
    label: "Chi tiết",
    instruction:
      "Giọng văn chi tiết, thực chiến, kinh nghiệm lái xe đường trường, miêu tả rõ cung đường, thời tiết, trạng thái mặt đường và các trạm dừng chân.",
  },
  nostalgic: {
    label: "Hoài niệm",
    instruction: "Giọng văn hoài niệm, mộc mạc, bình dị, như những trang lưu bút hành trình cùng bạn đồng hành.",
  },
} as const;

export type StoryTone = keyof typeof STORY_TONES;

export type TripStoryStop = {
  photoIndex: number;
  timeOfDay: string;
  stopTitle: string;
  locationGuess: string;
  story: string;
  mood: string;
  highlightQuote: string;
  // Not part of what Gemini generates -- attached server-side in
  // api/trips/[slug]/story/route.ts by matching photoIndex back to the
  // sampled photo's public URL, so the story page can show a real photo per
  // stop. Optional/undefined for any story generated before this field
  // existed (still renders fine, just without the image).
  photoUrl?: string;
};

export type TripStory = {
  tripTitle: string;
  summary: string;
  estimatedStats: { terrainTypes: string[]; vibeScore: string; weatherVibe: string };
  timeline: TripStoryStop[];
  conclusion: string;
  tone: StoryTone;
};
