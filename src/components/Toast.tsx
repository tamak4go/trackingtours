"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastTone = "default" | "success" | "error";
type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

const TONE_ICON: Record<ToastTone, string> = {
  default: "info",
  success: "check_circle",
  error: "error",
};

const TONE_COLOR: Record<ToastTone, string> = {
  default: "text-on-surface-variant",
  success: "text-accent-2",
  error: "text-error",
};

// App-wide replacement for window.alert() -- a native alert blocks the tab,
// can't be styled, and breaks every screen's own visual language. Mounted
// once at the root (see layout.tsx) so any client component can call
// useToast() without its own provider wiring.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  // ui-ux-pro-max `toast-dismiss`: auto-dismiss in the 3-5s window.
  const show = useCallback((message: string, tone: ToastTone = "default") => {
    const id = ++idRef.current;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* aria-live + no focus theft (toast-accessibility): announced to
          screen readers without ever moving keyboard focus off whatever the
          user was doing. */}
      <div
        aria-live="polite"
        className="fixed bottom-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="glass rounded-full pl-3 pr-4 py-2 flex items-center gap-2 text-sm text-on-surface shadow-xl shadow-black/40 pointer-events-auto max-w-[92vw] sm:max-w-sm"
            >
              <span className={`material-symbols-outlined text-lg shrink-0 ${TONE_COLOR[t.tone]}`}>{TONE_ICON[t.tone]}</span>
              <span className="truncate">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// Returns a `show(message, tone?)` function -- drop-in replacement for
// alert("..."). Must be called under <ToastProvider> (mounted in layout.tsx
// for the whole app).
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used within ToastProvider");
  return show;
}
