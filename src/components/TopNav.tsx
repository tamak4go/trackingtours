import Link from "next/link";
import { AuthButton } from "@/components/AuthButton";

// Shared between the home dashboard (/) and the upload flow (/upload) --
// the logo always links back to the dashboard.
export function TopNav() {
  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between px-5 sm:px-8 py-3.5 bg-black/20 backdrop-blur-xl border-b border-white/[0.06]">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-xl">🏍️</span>
        <span className="font-bold tracking-tight text-sm sm:text-base">
          Tracking <span className="text-gradient">Phượt</span>
        </span>
      </Link>
      <AuthButton />
    </nav>
  );
}
