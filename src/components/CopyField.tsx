"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable (e.g. insecure context) -- user can still select+copy manually
    }
  }

  return (
    <div>
      <div className="text-xs text-white/50 mb-1.5 font-medium">{label}</div>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-accent/50 transition-colors"
        />
        <button
          onClick={copy}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            copied ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] hover:bg-white/[0.1] text-white/80"
          }`}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Đã chép" : "Chép"}
        </button>
      </div>
    </div>
  );
}
