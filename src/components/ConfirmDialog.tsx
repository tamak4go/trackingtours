"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

// App-wide replacement for window.confirm() -- shared by TripView (delete a
// trip) and Settings (clear local trip list) so both destructive-action
// confirmations get the same glass/motion chrome instead of the native
// browser dialog. `icon` is left to the caller since TripView's screen uses
// Material Symbols and the rest of the app uses lucide-react -- this
// component doesn't take a side on that.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xoá",
  cancelLabel = "Huỷ",
  pending = false,
  pendingLabel,
  tone = "danger",
  icon,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  tone?: "danger" | "neutral";
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // A dialog that never receives focus is invisible to keyboard/screen
  // reader users even though Escape (below) lets them leave it once inside.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => !pending && onCancel()}
        >
          {/* Not anchored to a trigger button (unlike a dropdown menu), so
              transform-origin stays the default center -- Emil's popover
              rule doesn't apply to modals. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? "confirm-dialog-desc" : undefined}
            className="glass rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              {icon && (
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    tone === "danger" ? "bg-error-container text-error" : "bg-white/[0.06] text-accent"
                  }`}
                >
                  {icon}
                </div>
              )}
              <div>
                <h2 id="confirm-dialog-title" className="text-sm font-bold">
                  {title}
                </h2>
                {description && (
                  <p id="confirm-dialog-desc" className="text-xs text-on-surface-variant mt-0.5">
                    {description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                ref={cancelRef}
                onClick={onCancel}
                disabled={pending}
                className="flex-1 py-2.5 rounded-md text-xs font-semibold bg-surface-glass border border-border-glass text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={pending}
                className={`flex-1 py-2.5 rounded-md text-xs font-semibold transition-all duration-150 ease-snappy active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 focus-ring ${
                  tone === "danger" ? "bg-error text-on-error hover:brightness-105" : "glow-button text-neutral-950"
                }`}
              >
                {pending && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
                {pending ? pendingLabel || confirmLabel : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
