"use client";

import { Settings as SettingsIcon, Lock, LogOut, Trash2 } from "lucide-react";
import { useAuthUser } from "@/lib/use-auth-user";
import { useMyTrips, clearMyTrips } from "@/lib/my-trips";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useDefaultPrivate, setDefaultPrivate } from "@/lib/preferences";
import { DashboardShell } from "@/components/DashboardShell";

export default function SettingsPage() {
  const { user, loaded } = useAuthUser();
  const localTrips = useMyTrips();
  const defaultPrivate = useDefaultPrivate();

  function toggleDefaultPrivate() {
    setDefaultPrivate(!defaultPrivate);
  }

  function clearLocalTrips() {
    if (!confirm("Bỏ toàn bộ chuyến đi khỏi danh sách trên trình duyệt này? (Các chuyến đi vẫn còn nguyên trên server.)")) return;
    clearMyTrips();
  }

  const displayName = (user?.user_metadata?.full_name as string | undefined) || null;

  return (
    <DashboardShell active="settings">
      <div className="w-full max-w-2xl mt-10 sm:mt-14 pb-10">
        <div className="flex items-center gap-2.5 mb-8">
          <SettingsIcon size={22} className="text-accent-2" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white/95">Settings</h1>
        </div>

        {!loaded ? (
          <div className="text-center text-white/30 text-sm py-16 glass rounded-2xl">Đang tải...</div>
        ) : (
          <div className="flex flex-col gap-4">
            <section className="glass rounded-2xl p-5">
              <div className="text-[11px] text-white/35 uppercase tracking-wider mb-3">Tài khoản</div>
              {user ? (
                <div className="flex items-center gap-4">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" className="w-12 h-12 rounded-full border border-white/10" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-lg font-bold text-accent">
                      {(displayName || user.email || "?")[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/90 truncate">{displayName || "Rider"}</div>
                    <div className="text-xs text-white/40 truncate">{user.email}</div>
                  </div>
                  <button
                    onClick={() => supabaseBrowser().auth.signOut()}
                    className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-red-400/80 hover:text-red-400 bg-white/[0.04] hover:bg-white/[0.07] px-3.5 py-2 rounded-full transition-colors shrink-0"
                  >
                    <LogOut size={14} />
                    Đăng xuất
                  </button>
                </div>
              ) : (
                <p className="text-sm text-white/50">
                  Bạn chưa đăng nhập. Chuyến đi hiện chỉ được lưu trên trình duyệt này -- đăng nhập Google để lưu vào tài khoản
                  và dùng được Gallery, Stats, Map View.
                </p>
              )}
            </section>

            <section className="glass rounded-2xl p-5">
              <div className="text-[11px] text-white/35 uppercase tracking-wider mb-3">Mặc định khi tạo chuyến đi mới</div>
              <button
                onClick={toggleDefaultPrivate}
                role="switch"
                aria-checked={defaultPrivate}
                aria-label="Tạo chuyến đi ở chế độ riêng tư theo mặc định"
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/[0.05] flex items-center justify-center text-white/50 shrink-0">
                    <Lock size={15} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white/85">Tạo chuyến đi ở chế độ riêng tư</div>
                    <div className="text-xs text-white/40">Có thể đổi lại cho từng chuyến đi khi tạo</div>
                  </div>
                </div>
                <span
                  className={
                    defaultPrivate
                      ? "w-11 h-6 rounded-full bg-accent relative shrink-0 transition-colors duration-200 ease-snappy"
                      : "w-11 h-6 rounded-full bg-white/10 relative shrink-0 transition-colors duration-200 ease-snappy"
                  }
                >
                  <span
                    className={
                      defaultPrivate
                        ? "absolute top-0.5 left-[22px] w-5 h-5 rounded-full bg-neutral-950 transition-all duration-200 ease-snappy"
                        : "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 ease-snappy"
                    }
                  />
                </span>
              </button>
            </section>

            {!user && localTrips.length > 0 && (
              <section className="glass rounded-2xl p-5">
                <div className="text-[11px] text-white/35 uppercase tracking-wider mb-3">Dữ liệu cục bộ</div>
                <button
                  onClick={clearLocalTrips}
                  className="flex items-center gap-3 text-sm text-red-400/80 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                  Bỏ {localTrips.length} chuyến đi khỏi danh sách trên trình duyệt này
                </button>
              </section>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
