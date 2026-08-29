import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Display serif for headlines only -- distinctive, editorial, not another
// generic dashboard sans. Both faces need "vietnamese" in subsets or every
// accented word (nearly all Vietnamese copy in this app) silently falls
// back to a mismatched system font -- verified against Google Fonts' own
// served @font-face blocks before picking these two (Outfit, the reference
// site's sans, has NO vietnamese subset at all and was rejected for that).
const fraunces = Fraunces({
  variable: "--font-display-raw",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans-raw",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tracking Phượt",
  description: "Tính lộ trình phượt từ vị trí GPS trong ảnh và chia sẻ qua link",
  appleWebApp: { title: "Tracking Phượt", statusBarStyle: "black-translucent" },
};

// Matches --background (globals.css) so the OS status bar / browser chrome
// on mobile blends with the app instead of showing a default white/gray bar.
export const viewport: Viewport = {
  themeColor: "#060b14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${fraunces.variable} ${jakarta.variable} h-full antialiased`}
    >
      <head>
        {/* Icon font used by the trip share screen (Material Symbols). */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
