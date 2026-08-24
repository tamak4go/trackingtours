// Shown on the account-only pages (Gallery, Stats, Map View, parts of
// Settings) when nobody's signed in -- those aggregate across trips server-
// side by user_id, which anonymous/local trips (tracked only in
// localStorage, see src/lib/my-trips.ts) have no way to participate in.
export function SignInPrompt({ reason }: { reason: string }) {
  return (
    <div className="text-center py-16 glass rounded-2xl flex flex-col items-center gap-3">
      <p className="text-white/50 text-sm max-w-sm">{reason} Đăng nhập bằng Google để xem.</p>
    </div>
  );
}
