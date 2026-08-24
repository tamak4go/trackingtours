"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Images, FolderUp, FileArchive, ImageDown, Info, Loader2, CheckCircle2, Route, Trash2, ArrowUpRight } from "lucide-react";
import { parsePhotoExif, compressPhoto, type ParsedPhoto } from "@/lib/process-photos";
import { extractTakeoutZips, type GeoFallback } from "@/lib/process-takeout";
import { fetchRoadRoute, haversineKm } from "@/lib/geo";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useMyTrips, saveMyTrip, removeMyTrip } from "@/lib/my-trips";
import { useAuthUser } from "@/lib/use-auth-user";
import { pickFromGooglePhotos, getGoogleProviderToken } from "@/lib/google-photos";
import { CopyField } from "@/components/CopyField";
import { AuthButton } from "@/components/AuthButton";

type Stage = "idle" | "processing" | "done" | "error";

type CreateTripApiResponse = {
  slug: string;
  editToken: string;
  shareUrl: string;
  editUrl: string;
  uploads: { photoId: string; path: string; token: string }[];
};

type AccountTrip = {
  slug: string;
  title: string | null;
  distanceKm: number;
  photoCount: number;
  createdAt: string;
  shareUrl: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("idle");
  const [consent, setConsent] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<CreateTripApiResponse | null>(null);
  const localTrips = useMyTrips();
  const { user } = useAuthUser();
  // Signed-in users see their trips synced from the database (by account,
  // works across devices/browsers) instead of the localStorage list -- see
  // GET /api/my-trips. Signed-out users keep the old localStorage-only list.
  const [accountTrips, setAccountTrips] = useState<AccountTrip[] | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/my-trips")
      .then((res) => (res.ok ? res.json() : { trips: [] }))
      .then((data) => {
        if (!cancelled) setAccountTrips(data.trips ?? []);
      })
      .catch(() => {
        if (!cancelled) setAccountTrips([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);
  const imagesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  async function runPipeline(files: File[], geoFallback?: Map<string, GeoFallback>) {
    setStage("processing");
    setErrorMsg("");
    setResult(null);
    setWarnings([]);

    const imageFiles = files.filter((f) => /\.(jpe?g|png|heic|heif|tiff?|webp)$/i.test(f.name));
    if (!imageFiles.length) {
      setErrorMsg("Không tìm thấy ảnh.");
      setStage("error");
      return;
    }

    setStatusMsg("Đang đọc vị trí GPS trong ảnh...");
    setProgress({ done: 0, total: imageFiles.length });
    const parsed: ParsedPhoto[] = [];
    for (const f of imageFiles) {
      const p = await parsePhotoExif(f);
      const fb = geoFallback?.get(f.name);
      if (fb) {
        if (p.lat == null && Number.isFinite(fb.lat)) p.lat = fb.lat;
        if (p.lng == null && Number.isFinite(fb.lng)) p.lng = fb.lng;
        if (p.time == null && fb.time) p.time = fb.time;
      }
      parsed.push(p);
      setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }
    parsed.sort((a, b) => (a.time?.getTime() ?? 0) - (b.time?.getTime() ?? 0));
    const geo = parsed.filter(
      (p): p is ParsedPhoto & { lat: number; lng: number; time: Date } =>
        Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.time != null,
    );

    if (geo.length < 2) {
      setErrorMsg(
        `Chỉ tìm thấy ${geo.length} ảnh có GPS trong ${imageFiles.length} ảnh. Cần ít nhất 2 ảnh có vị trí để dựng lộ trình.`,
      );
      setStage("error");
      return;
    }

    setStatusMsg("Đang tính lộ trình thực tế...");
    let routeMode: "road" | "straight" = "straight";
    let routeCoords: [number, number][] = geo.map((p) => [p.lng, p.lat]);
    let distanceKm = geo.slice(1).reduce((sum, p, i) => sum + haversineKm(geo[i], p), 0);
    const durationMs = geo[geo.length - 1].time.getTime() - geo[0].time.getTime();

    if (geo.length <= 100) {
      try {
        const route = await fetchRoadRoute(geo);
        routeMode = "road";
        routeCoords = route.coords;
        distanceKm = route.distanceKm;
      } catch (err) {
        console.warn("Routing failed, falling back to straight line", err);
      }
    }

    setStatusMsg("Đang nén ảnh trước khi tải lên...");
    setProgress({ done: 0, total: geo.length });
    const compressed: { photo: (typeof geo)[number]; blob: Blob }[] = [];
    const localWarnings: string[] = [];
    for (const p of geo) {
      try {
        const blob = await compressPhoto(p.file);
        compressed.push({ photo: p, blob });
      } catch (err) {
        localWarnings.push(err instanceof Error ? err.message : `${p.name}: xử lý ảnh thất bại, đã bỏ qua.`);
      }
      setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    if (compressed.length < 2) {
      setErrorMsg("Không đủ ảnh xử lý được (cần ít nhất 2 ảnh) để tạo lộ trình. " + localWarnings.join(" "));
      setStage("error");
      return;
    }

    setStatusMsg("Đang tạo chuyến đi...");
    let created: CreateTripApiResponse;
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distanceKm,
          durationMs,
          routeMode,
          routeCoords,
          photos: compressed.map((c) => ({
            fileName: c.photo.name,
            lat: c.photo.lat,
            lng: c.photo.lng,
            takenAt: c.photo.time.toISOString(),
            contentType: c.blob.type || "image/webp",
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server trả lỗi ${res.status}`);
      }
      created = await res.json();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Tạo chuyến đi thất bại. Đã cấu hình Supabase trong .env.local chưa?");
      setStage("error");
      return;
    }

    setStatusMsg("Đang tải ảnh lên...");
    setProgress({ done: 0, total: compressed.length });
    const sb = supabaseBrowser();
    let idx = 0;
    let uploadFailures = 0;
    async function worker() {
      while (idx < compressed.length) {
        const i = idx++;
        const upload = created.uploads[i];
        const { blob } = compressed[i];
        const { error } = await sb.storage.from("trip-photos").uploadToSignedUrl(upload.path, upload.token, blob);
        if (error) {
          console.error("upload failed", upload.path, error);
          uploadFailures++;
        }
        setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
    if (uploadFailures > 0) localWarnings.push(`${uploadFailures} ảnh tải lên thất bại (mạng chậm hoặc mất kết nối).`);

    saveMyTrip({
      slug: created.slug,
      shareUrl: created.shareUrl,
      editUrl: created.editUrl,
      distanceKm,
      photoCount: compressed.length,
      createdAt: new Date().toISOString(),
    });

    setStatusMsg(localWarnings.length ? "Tạo xong, nhưng có vài ảnh bị bỏ qua." : "Đã tạo chuyến đi!");
    setWarnings(localWarnings);
    setResult(created);
    setStage("done");
  }

  function handlePlainFilesChange(fileList: FileList) {
    if (!consent) {
      setErrorMsg("Vui lòng đồng ý ở checkbox bên dưới trước khi chọn ảnh.");
      return;
    }
    setErrorMsg("");
    runPipeline(Array.from(fileList));
  }

  async function handleZipChange(fileList: FileList) {
    if (!consent) {
      setErrorMsg("Vui lòng đồng ý ở checkbox bên dưới trước khi chọn file.");
      return;
    }
    const zips = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith(".zip"));
    if (!zips.length) {
      setErrorMsg("Vui lòng chọn (các) file .zip xuất từ Google Takeout.");
      return;
    }
    setErrorMsg("");
    setStage("processing");
    setStatusMsg("Đang giải nén file Takeout...");
    setProgress({ done: 0, total: 1 });
    try {
      const { files, geoFallback, skippedNonImages } = await extractTakeoutZips(zips, (done, total) =>
        setProgress({ done, total: Math.max(total, 1) }),
      );
      if (!files.length) {
        setErrorMsg("Không tìm thấy ảnh nào trong file ZIP đã chọn.");
        setStage("error");
        return;
      }
      void skippedNonImages;
      await runPipeline(files, geoFallback);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Đọc file ZIP thất bại.");
      setStage("error");
    }
  }

  function pickImages() {
    if (!consent) {
      setErrorMsg("Vui lòng đồng ý ở checkbox bên dưới trước khi chọn ảnh.");
      return;
    }
    setErrorMsg("");
    imagesInputRef.current?.click();
  }

  function pickFolder() {
    if (!consent) {
      setErrorMsg("Vui lòng đồng ý ở checkbox bên dưới trước khi chọn ảnh.");
      return;
    }
    setErrorMsg("");
    folderInputRef.current?.click();
  }

  function pickZip() {
    if (!consent) {
      setErrorMsg("Vui lòng đồng ý ở checkbox bên dưới trước khi chọn file.");
      return;
    }
    setErrorMsg("");
    zipInputRef.current?.click();
  }

  async function pickGooglePhotos() {
    if (!consent) {
      setErrorMsg("Vui lòng đồng ý ở checkbox bên dưới trước khi chọn ảnh.");
      return;
    }
    const token = getGoogleProviderToken();
    if (!user || !token) {
      setErrorMsg("Đăng nhập Google (nút góc trên) trước để nhập ảnh từ Google Photos.");
      return;
    }
    setErrorMsg("");
    setStage("processing");
    setStatusMsg("Đang mở Google Photos để chọn ảnh...");
    setProgress({ done: 0, total: 0 });
    try {
      const files = await pickFromGooglePhotos(
        token,
        (pickerUri) => window.open(pickerUri, "_blank", "noopener,noreferrer"),
        (done, total) => {
          setProgress({ done, total });
          setStatusMsg(`Đang tải ${done}/${total} ảnh từ Google Photos...`);
        },
      );
      if (!files.length) {
        setStage("idle");
        return;
      }
      await runPipeline(files);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Nhập ảnh từ Google Photos thất bại.");
      setStage("error");
    }
  }

  function reset() {
    setStage("idle");
    setResult(null);
    setErrorMsg("");
    setWarnings([]);
    if (imagesInputRef.current) imagesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (zipInputRef.current) zipInputRef.current.value = "";
  }

  const progressPct = progress.total ? (progress.done / progress.total) * 100 : 0;

  return (
    <main className="flex-1 flex items-center justify-center p-6 relative">
      <div className="bg-mesh" />
      <div className="absolute top-6 right-6 z-10">
        <AuthButton />
      </div>

      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-9"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-[#ff5f8f] shadow-lg shadow-accent/30 text-2xl mb-4">
            🏍️
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Tracking <span className="text-gradient">Phượt</span>
          </h1>
          <p className="text-white/50 text-sm mt-2.5 leading-relaxed max-w-sm mx-auto">
            Upload ảnh chuyến đi → tự tính lộ trình từ GPS trong ảnh → có link chia sẻ cho bạn bè xem lại.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass rounded-3xl p-6 shadow-2xl shadow-black/40"
        >
          <AnimatePresence mode="wait">
            {(stage === "idle" || stage === "error") && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <input
                  ref={imagesInputRef}
                  type="file"
                  multiple
                  // No `accept` filter on purpose: with accept="image/*" on
                  // Android, Chrome opens the system Photos picker, which
                  // strips GPS from EXIF before handing files over (a
                  // deliberate Android privacy behavior). Without it,
                  // Android falls back to the Files/document picker, which
                  // leaves EXIF (including GPS) untouched. We still filter
                  // to image extensions ourselves in runPipeline.
                  className="hidden"
                  onChange={(e) => e.target.files && handlePlainFilesChange(e.target.files)}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  // @ts-expect-error -- non-standard attributes, no TS types but supported by Chromium/Firefox
                  webkitdirectory="true"
                  directory=""
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handlePlainFilesChange(e.target.files)}
                />
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleZipChange(e.target.files)}
                />

                <button
                  onClick={pickImages}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold bg-gradient-to-r from-accent to-[#ff5f8f] text-neutral-950 shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:brightness-105 active:scale-[0.99] transition-all"
                >
                  <Images size={18} strokeWidth={2.4} />
                  Chọn ảnh
                </button>
                <p className="text-[11px] text-white/35 mt-1.5 px-1">
                  Chọn nhiều ảnh cùng lúc từ máy hoặc Thư viện ảnh trên điện thoại. Trên Android, nếu báo 0 ảnh có GPS, thử
                  chọn qua tab <b>&ldquo;Tệp&rdquo;/&ldquo;Files&rdquo;</b> thay vì Ảnh/Gallery — trình chọn Ảnh của Android tự xoá GPS vì lý do
                  riêng tư.
                </p>

                <div className="flex items-center gap-3 my-4 text-[11px] font-medium text-white/30 uppercase tracking-wider">
                  <div className="flex-1 h-px bg-white/10" />
                  hoặc
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={pickFolder}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] active:scale-[0.99] transition-all"
                  >
                    <FolderUp size={16} strokeWidth={2.4} className="text-accent-2" />
                    Cả thư mục
                  </button>
                  <button
                    onClick={pickZip}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] active:scale-[0.99] transition-all"
                  >
                    <FileArchive size={16} strokeWidth={2.4} className="text-accent-2" />
                    Google Takeout
                  </button>
                </div>
                <p className="text-[11px] text-white/35 mt-2 leading-relaxed px-1">
                  &ldquo;Cả thư mục&rdquo; lấy hết ảnh trong thư mục (kể cả thư mục con) — chỉ dùng được trên máy tính. Google Takeout
                  (xuất từ{" "}
                  <a href="https://takeout.google.com" target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">
                    takeout.google.com
                  </a>
                  ) giữ được GPS kể cả khi ảnh gốc không có EXIF vị trí.
                </p>

                <button
                  onClick={pickGooglePhotos}
                  disabled={!user}
                  className="w-full flex items-center justify-center gap-1.5 py-3 mt-2 rounded-xl text-sm font-semibold bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ImageDown size={16} strokeWidth={2.4} className="text-accent-2" />
                  Nhập từ Google Photos
                </button>
                <p className="text-[11px] text-white/35 mt-1.5 px-1">
                  {user
                    ? "Chỉ ảnh backup ở chất lượng gốc mới còn giữ GPS."
                    : "Cần đăng nhập Google (nút góc trên) trước."}
                </p>

                <label className="flex items-start gap-2.5 mt-5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 accent-accent w-3.5 h-3.5 shrink-0"
                  />
                  <span>
                    Tôi hiểu rằng ảnh và vị trí GPS trong chuyến đi này sẽ <b className="text-white/70">công khai</b> với bất
                    kỳ ai có link chia sẻ (không cần đăng nhập để xem).
                  </span>
                </label>

                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-1.5 text-sm text-red-400 mt-4"
                  >
                    <Info size={15} className="shrink-0 mt-0.5" />
                    {errorMsg}
                  </motion.p>
                )}

                <p className="flex items-start gap-1.5 text-[11px] text-white/30 mt-4 leading-relaxed">
                  <Info size={13} className="shrink-0 mt-0.5" />
                  Chỉ ảnh có GPS mới dùng được. Ảnh HEIC (iPhone) đọc được vị trí bình thường; nếu trình duyệt không nén được
                  ảnh gốc, app sẽ tự tải lên bản gốc thay vì bỏ qua.
                </p>
              </motion.div>
            )}

            {stage === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-6"
              >
                <Loader2 size={28} className="mx-auto mb-4 text-accent animate-spin" />
                <div className="text-sm text-white/70 mb-4">{statusMsg}</div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent to-[#ff5f8f] rounded-full"
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
                <div className="text-xs text-white/35 mt-2 tabular-nums">
                  {progress.done}/{progress.total}
                </div>
              </motion.div>
            )}

            {stage === "done" && result && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center text-center gap-2 pb-1">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                  <div className="text-sm text-white/70">{statusMsg || "Đã tạo chuyến đi!"}</div>
                </div>
                {warnings.length > 0 && (
                  <ul className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="flex gap-1.5">
                        <Info size={13} className="shrink-0 mt-0.5" /> {w}
                      </li>
                    ))}
                  </ul>
                )}
                <CopyField label="Link xem & chia sẻ" value={result.shareUrl} />
                <CopyField label="Link quản lý (để xoá sau này, giữ riêng cho bạn)" value={result.editUrl} />
                <a
                  href={result.shareUrl}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold bg-gradient-to-r from-accent to-[#ff5f8f] text-neutral-950 shadow-lg shadow-accent/25 hover:brightness-105 active:scale-[0.99] transition-all"
                >
                  Xem chuyến đi
                  <ArrowUpRight size={18} />
                </a>
                <button onClick={reset} className="w-full py-2 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors">
                  Tạo chuyến đi khác
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {(stage === "idle" || stage === "error") && (user ? accountTrips && accountTrips.length > 0 : localTrips.length > 0) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-6">
            <div className="text-[11px] text-white/35 mb-2 px-1 font-medium uppercase tracking-wider">
              Chuyến đi của tôi {user ? "(theo tài khoản Google)" : "(lưu trên trình duyệt này)"}
            </div>
            <div className="glass rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
              {user
                ? accountTrips!.map((t) => (
                    <div key={t.slug} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                        <Route size={14} className="text-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <a href={t.shareUrl} className="text-sm text-white/85 hover:text-accent truncate block font-medium">
                          {t.title || `${t.distanceKm.toFixed(1)} km · ${t.photoCount} ảnh`}
                        </a>
                        <div className="text-[11px] text-white/35">{fmtDate(t.createdAt)}</div>
                      </div>
                      <a href={t.shareUrl} className="text-[11px] text-accent-2 hover:underline shrink-0 font-medium">
                        Quản lý
                      </a>
                    </div>
                  ))
                : localTrips.map((t) => (
                    <div key={t.slug} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                        <Route size={14} className="text-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <a href={t.shareUrl} className="text-sm text-white/85 hover:text-accent truncate block font-medium">
                          {t.distanceKm.toFixed(1)} km · {t.photoCount} ảnh
                        </a>
                        <div className="text-[11px] text-white/35">{fmtDate(t.createdAt)}</div>
                      </div>
                      <a href={t.editUrl} className="text-[11px] text-accent-2 hover:underline shrink-0 font-medium">
                        Quản lý
                      </a>
                      <button
                        onClick={() => removeMyTrip(t.slug)}
                        className="text-white/25 hover:text-red-400 shrink-0 transition-colors"
                        title="Bỏ khỏi danh sách này (không xoá chuyến đi)"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
