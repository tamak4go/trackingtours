import type { LucideIcon } from "lucide-react";

// Was 17 copy-pasted "glass rounded-2xl, centered text" boxes across 8
// pages -- the single most-repeated generic "empty state card" pattern in
// the app. Left-aligned line + border-top divider instead, matching the
// Home page's de-genericized empty state.
export function StatusPanel({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-muted text-sm py-6 border-t border-white/[0.06]">
      {Icon && <Icon size={16} className="text-accent shrink-0" />}
      {children}
    </div>
  );
}
