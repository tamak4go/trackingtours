"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import type { Trip } from "@/lib/types";
import { STORY_TONES, type StoryTone, type TripStory } from "@/lib/story-types";

// Dedicated full-page reading view for the AI-generated trip journal --
// pulled out of TripView's small map-overlay panel into its own route
// (see src/app/t/[slug]/story/page.tsx) so the full multi-stop timeline has
// room to breathe instead of competing with the map for space. Visual
// language (vertical gradient timeline, "Stop 0N" labels, full-bleed
// photos, accent-bordered pull quotes) is deliberately close to the
// companion Google AI Studio app's TimelineView, since that design already
// proved itself for this exact content shape.
export function StoryView({ trip, editToken, canEdit }: { trip: Trip; editToken: string | null; canEdit: boolean }) {
  const [storyAvailable, setStoryAvailable] = useState(false);
  const [storyData, setStoryData] = useState<TripStory | null>(trip.storyJson);
  const [selectedTone, setSelectedTone] = useState<StoryTone>(trip.storyJson?.tone ?? "enthusiastic");
  const [generatingStory, setGeneratingStory] = useState(false);

  useEffect(() => {
    fetch(`/api/trips/${trip.slug}/story`)
      .then((r) => r.json())
      .then((d) => setStoryAvailable(Boolean(d.available)))
      .catch(() => {});
  }, [trip.slug]);

  function tripApiUrl(path: string): string {
    return editToken ? `${path}?token=${encodeURIComponent(editToken)}` : path;
  }

  async function handleGenerateStory(tone: StoryTone = selectedTone) {
    if (!canEdit || generatingStory) return;
    setGeneratingStory(true);
    try {
      const res = await fetch(tripApiUrl(`/api/trips/${trip.slug}/story`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone }),
      });
      const data = await res.json();
      if (res.ok) {
        setStoryData(data.story as TripStory);
        setSelectedTone(tone);
      } else {
        alert(data.error || "Tạo câu chuyện thất bại.");
      }
    } catch {
      alert("Tạo câu chuyện thất bại.");
    } finally {
      setGeneratingStory(false);
    }
  }

  const backHref = `/t/${trip.slug}${editToken ? `?edit=${encodeURIComponent(editToken)}` : ""}`;

  return (
    <div className="min-h-dvh bg-md-background text-on-surface">
      <header className="sticky top-0 z-20 glass px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link
          href={backHref}
          className="w-9 h-9 rounded-full bg-surface-glass flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors shrink-0 focus-ring"
          aria-label="Quay lại bản đồ"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-secondary font-mono">AI Travel Journaling</p>
          <h1 className="text-sm font-bold truncate">{trip.title || "Chuyến đi phượt"}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {!storyData ? (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-5xl text-primary-container">auto_awesome</span>
            <p className="text-on-surface-variant text-sm max-w-sm">
              {storyAvailable ? "Chuyến đi này chưa có câu chuyện AI." : "Tính năng chưa được bật trên server này."}
            </p>
            {canEdit && storyAvailable && (
              <button
                onClick={() => handleGenerateStory()}
                disabled={generatingStory}
                className="glow-button text-neutral-950 text-sm font-bold px-6 py-2.5 rounded-full disabled:opacity-50 focus-ring"
              >
                {generatingStory ? "Đang viết..." : "Tạo câu chuyện AI ✨"}
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-widest text-secondary font-mono mb-2">Gemini Vision AI</p>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight mb-4">{storyData.tripTitle}</h2>
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-5">{storyData.summary}</p>

            <div className="flex flex-wrap gap-2 mb-6">
              {storyData.estimatedStats.terrainTypes.map((t) => (
                <span key={t} className="pill text-xs text-secondary">
                  {t}
                </span>
              ))}
              <span className="pill text-xs text-secondary">{storyData.estimatedStats.weatherVibe}</span>
              <span className="pill text-xs text-accent font-semibold">{storyData.estimatedStats.vibeScore}</span>
            </div>

            {canEdit && storyAvailable && (
              <div className="flex flex-wrap gap-2 mb-10 pb-6 border-b border-border-glass">
                {(Object.keys(STORY_TONES) as StoryTone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleGenerateStory(t)}
                    disabled={generatingStory}
                    title="Viết lại với giọng văn này"
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      selectedTone === t
                        ? "bg-accent text-neutral-950 font-semibold"
                        : "bg-surface-glass text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {STORY_TONES[t].label}
                  </button>
                ))}
              </div>
            )}

            <div className="relative pl-8 sm:pl-10">
              <div
                className="absolute left-[11px] sm:left-[13px] top-2 bottom-2 w-px"
                style={{ background: "linear-gradient(to bottom, var(--color-accent), transparent)" }}
              />
              <div className="flex flex-col gap-10 sm:gap-12">
                {storyData.timeline.map((stop, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-8 sm:-left-10 top-1 w-6 h-6 rounded-full bg-md-background border-2 border-accent flex items-center justify-center">
                      <span className="text-[10px] font-mono font-bold text-accent">{i + 1}</span>
                    </div>

                    <p className="text-[11px] uppercase tracking-widest text-secondary font-mono mb-1.5">
                      Stop {String(i + 1).padStart(2, "0")} · {stop.timeOfDay}
                    </p>

                    {stop.photoUrl && (
                      <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-3 border border-border-glass">
                        <NextImage
                          src={stop.photoUrl}
                          alt={stop.stopTitle}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 672px"
                        />
                      </div>
                    )}

                    <h3 className="text-lg font-bold mb-1">{stop.stopTitle}</h3>
                    <p className="text-xs text-secondary mb-2">
                      {stop.locationGuess} · {stop.mood}
                    </p>
                    <p className="text-sm text-on-surface-variant leading-relaxed mb-3">{stop.story}</p>
                    <blockquote className="border-l-2 border-accent pl-3 text-sm italic text-primary-container">
                      &ldquo;{stop.highlightQuote}&rdquo;
                    </blockquote>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border-glass text-center">
              <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed italic max-w-lg mx-auto">
                {storyData.conclusion}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
