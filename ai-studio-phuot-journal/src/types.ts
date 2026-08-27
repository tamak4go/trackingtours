export interface TripInput {
  title: string;
  route: string;
  days: number;
  highlights: string;
  tone: 'hào hứng' | 'hoài niệm' | 'hài hước';
}

export interface JournalResult {
  story: string;
  highlightMoments: string[];
  itineraryTips: string[];
  socialCaption: string;
}
