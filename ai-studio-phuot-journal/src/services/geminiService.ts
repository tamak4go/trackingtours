import { GoogleGenAI, Type } from '@google/genai';
import type { TripInput, JournalResult } from '../types';

// AI Studio's Build tool wires process.env.API_KEY to the project's Gemini key
// automatically — no change needed when you paste this into AI Studio.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    story: {
      type: Type.STRING,
      description: 'Bài nhật ký hành trình phượt, viết ở ngôi thứ nhất, 200-350 từ, tiếng Việt.',
    },
    highlightMoments: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3-5 khoảnh khắc nổi bật nhất của chuyến đi, mỗi cái 1 câu ngắn.',
    },
    itineraryTips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3-5 gợi ý lịch trình/kinh nghiệm hữu ích cho người đi sau.',
    },
    socialCaption: {
      type: Type.STRING,
      description: 'Caption ngắn (kèm hashtag) để đăng Facebook/Instagram, tối đa 300 ký tự.',
    },
  },
  required: ['story', 'highlightMoments', 'itineraryTips', 'socialCaption'],
};

export async function generateJournal(input: TripInput): Promise<JournalResult> {
  const prompt = `Bạn là một biên tập viên du lịch chuyên viết nhật ký "phượt" (du lịch bụi/xe máy) cho cộng đồng người Việt.

Thông tin chuyến đi:
- Tên chuyến đi: ${input.title}
- Cung đường / điểm dừng: ${input.route}
- Số ngày: ${input.days}
- Những khoảnh khắc/ghi chú thô của người đi: ${input.highlights}
- Giọng văn mong muốn: ${input.tone}

Hãy viết lại thành một bài nhật ký hành trình sống động, đúng chất phượt Việt Nam, cùng các gợi ý theo đúng schema JSON được yêu cầu.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  return JSON.parse(response.text) as JournalResult;
}
