"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  UploadCloud,
  CheckCircle2,
  FolderUp,
  FileArchive,
  ImageDown,
  Info,
  Loader2,
  Rocket,
  ArrowUpRight,
  MapPinned,
  Route as RouteIcon,
} from "lucide-react";
import { parsePhotoExif, compressPhoto, type ParsedPhoto } from "@/lib/process-photos";
import { extractTakeoutZips, type GeoFallback } from "@/lib/process-takeout";
import { fetchRoadRoute, haversineKm } from "@/lib/geo";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { saveMyTrip } from "@/lib/my-trips";
import { useAuthUser } from "@/lib/use-auth-user";
import { pickFromGooglePhotos, getGoogleProviderToken } from "@/lib/google-photos";
import { CopyField } from "@/components/CopyField";
import { TopNav } from "@/components/TopNav";

type Stage = "idle" | "processing" | "done" | "error";

type CreateTripApiResponse = {
  slug: string;
  editToken: string;
  shareUrl: string;
  editUrl: string;
  uploads: { photoId: string; path: string; token: string }[];
};

const STEPS = [
  { icon: UploadCloud, title: "1. Upload ảnh", body: "Kéo thả hoặc chọn ảnh từ chuyến đi của bạn." },
  { icon: MapPinned, title: "2. Xử lý GPS", body: "Hệ thống tự động trích xuất vị trí từ metadata ảnh." },
  { icon: RouteIcon, title: "3. Tạo hành trình", body: "Bản đồ tương tác sẵn sàng để chia sẻ." },
];

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [consent, setConsent] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Files picked via the dropzone / "Chọn ảnh" click / "Cả thư mục" sit here
  // for review (mirrors the mockup's dropzone-then-"Bắt đầu xử lý" flow)
  // rather than kicking off the pipeline immediately. Google Takeout and
  // Google Photos import skip this -- both already have their own async
  // fetch/extract step before a file count is even known, so an extra
  // staged-review step on top would just be redundant.
  const [selectedFiles, setSelectedFiles] = useState<File[] | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<CreateTripApiResponse | null>(null);
  const { user } = useAuthUser();
  const imagesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // The public-GPS disclosure only matters for a public trip -- a private
  // one is never exposed to anyone without the edit link/account, so there's
  // nothing to consent to in that case.
  function ensureConsent(): boolean {
    if (isPrivate) return true;
    if (!consent) {
      setErrorMsg("Vui lòng đồng ý công khai ảnh & GPS bên dưới, hoặc bật chế độ riêng tư.");
      return false;
    }
    return true;
  }

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
          isPublic: !isPrivate,
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

    const firstUpload = created.uploads[0];
    saveMyTrip({
      slug: created.slug,
      shareUrl: created.shareUrl,
      editUrl: created.editUrl,
      distanceKm,
      photoCount: compressed.length,
      isPublic: !isPrivate,
      createdAt: new Date().toISOString(),
      photoUrl: firstUpload
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/trip-photos/${firstUpload.path}`
        : null,
    });

    setStatusMsg(localWarnings.length ? "Tạo xong, nhưng có vài ảnh bị bỏ qua." : "Đã tạo chuyến đi!");
    setWarnings(localWarnings);
    setResult(created);
    setStage("done");
  }

  function stageFiles(files: File[]) {
    if (!ensureConsent()) return;
    setErrorMsg("");
    setSelectedFiles(files);
  }

  function startProcessing() {
    if (!selectedFiles) return;
    runPipeline(selectedFiles);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    stageFiles(Array.from(e.dataTransfer.files));
  }

  async function handleZipChange(fileList: FileList) {
    if (!ensureConsent()) return;
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
    if (!ensureConsent()) return;
    imagesInputRef.current?.click();
  }

  function pickFolder() {
    if (!ensureConsent()) return;
    folderInputRef.current?.click();
  }

  function pickZip() {
    if (!ensureConsent()) return;
    zipInputRef.current?.click();
  }

  async function pickGooglePhotos() {
    if (!ensureConsent()) return;
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
    setSelectedFiles(null);
    if (imagesInputRef.current) imagesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (zipInputRef.current) zipInputRef.current.value = "";
  }

  const progressPct = progress.total ? (progress.done / progress.total) * 100 : 0;

  return (
    <>
      <div className="bg-mesh" />
      <TopNav />

      <main className="flex-1 flex flex-col items-center p-6 relative gap-6">
        <div className="w-full max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/40 flex flex-col items-center text-center"
          >
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-accent mb-2">Tạo hành trình của bạn</h1>
            <p className="text-white/50 text-sm mb-7">Kéo thả ảnh hoặc chọn từ thiết bị để bắt đầu trích xuất GPS.</p>

            <AnimatePresence mode="wait">
              {(stage === "idle" || stage === "error") && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
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
                    onChange={(e) => e.target.files && stageFiles(Array.from(e.target.files))}
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
                    onChange={(e) => e.target.files && stageFiles(Array.from(e.target.files))}
                  />
                  <input
                    ref={zipInputRef}
                    type="file"
                    accept=".zip"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleZipChange(e.target.files)}
                  />

                  <div
                    onClick={pickImages}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`w-full rounded-2xl p-10 flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed transition-colors ${
                      dragOver ? "border-accent bg-accent/5" : "border-white/15 hover:border-white/25"
                    }`}
                  >
                    {selectedFiles ? (
                      <>
                        <CheckCircle2 size={40} className="text-accent-2 mb-2" />
                        <span className="text-lg font-semibold">Đã chọn {selectedFiles.length} tệp</span>
                        <span className="text-xs text-white/40">Nhấp để chọn lại</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={40} className="text-white/40 mb-2" />
                        <span className="text-lg font-semibold">Kéo &amp; thả ảnh vào đây</span>
                        <span className="text-xs text-white/40">hoặc nhấp để chọn tệp (JPG, PNG, HEIC)</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 justify-center mt-3">
                    <button onClick={pickFolder} className="text-[11px] text-white/40 hover:text-accent-2 transition-colors flex items-center gap-1">
                      <FolderUp size={12} /> Cả thư mục
                    </button>
                    <span className="text-white/20">·</span>
                    <button onClick={pickZip} className="text-[11px] text-white/40 hover:text-accent-2 transition-colors flex items-center gap-1">
                      <FileArchive size={12} /> Google Takeout
                    </button>
                  </div>

                  <div className="flex items-center gap-4 w-full justify-center my-6">
                    <div className="h-px bg-white/10 flex-grow" />
                    <span className="text-[10px] text-white/30 uppercase tracking-widest">Hoặc</span>
                    <div className="h-px bg-white/10 flex-grow" />
                  </div>

                  <button
                    onClick={pickGooglePhotos}
                    disabled={!user}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ImageDown size={16} className="text-accent-2" />
                    Chọn từ Google Photos
                  </button>
                  <p className="text-[11px] text-white/35 mt-1.5">
                    {user ? "Chỉ ảnh backup ở chất lượng gốc mới còn giữ GPS." : "Cần đăng nhập Google (nút góc trên) trước."}
                  </p>

                  <div className="w-full flex flex-col gap-3 border-t border-white/10 pt-6 mt-6 text-left">
                    <label className="flex items-start gap-2.5 text-xs text-white/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="mt-0.5 accent-accent w-3.5 h-3.5 shrink-0"
                      />
                      <span>
                        Đặt chuyến đi ở chế độ <b className="text-white/70">riêng tư</b>: chỉ mở được bằng link quản lý hoặc tài
                        khoản của bạn. Đổi lại được bất cứ lúc nào ở trang chuyến đi.
                      </span>
                    </label>
                    {!isPrivate && (
                      <label className="flex items-start gap-2.5 text-xs text-white/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          className="mt-0.5 accent-accent w-3.5 h-3.5 shrink-0"
                        />
                        <span>
                          Tôi hiểu rằng ảnh và vị trí GPS trong chuyến đi này sẽ <b className="text-white/70">công khai</b> với
                          bất kỳ ai có link chia sẻ (không cần đăng nhập để xem).
                        </span>
                      </label>
                    )}

                    {errorMsg && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-1.5 text-sm text-red-400"
                      >
                        <Info size={15} className="shrink-0 mt-0.5" />
                        {errorMsg}
                      </motion.p>
                    )}

                    <button
                      onClick={startProcessing}
                      disabled={!selectedFiles}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold uppercase tracking-wide text-sm bg-gradient-to-r from-accent to-[#ff5f8f] text-neutral-950 shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <Rocket size={18} />
                      Bắt đầu xử lý
                    </button>
                    <p className="flex items-start gap-1.5 text-[11px] text-white/30 leading-relaxed">
                      <Info size={13} className="shrink-0 mt-0.5" />
                      Chỉ ảnh có GPS mới dùng được. Ảnh HEIC (iPhone) đọc được vị trí bình thường; nếu trình duyệt không nén được
                      ảnh gốc, app sẽ tự tải lên bản gốc thay vì bỏ qua.
                    </p>
                  </div>
                </motion.div>
              )}

              {stage === "processing" && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-6 w-full"
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
                  className="space-y-4 w-full text-left"
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
                  <div className="flex gap-2">
                    <button
                      onClick={reset}
                      className="flex-1 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors"
                    >
                      Tạo chuyến đi khác
                    </button>
                    <Link
                      href="/"
                      className="flex-1 py-2 rounded-xl text-sm text-center text-white/40 hover:text-white/70 transition-colors"
                    >
                      Về trang chủ
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {(stage === "idle" || stage === "error") && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6"
            >
              {STEPS.map((s) => (
                <div key={s.title} className="glass rounded-2xl p-5 flex flex-col items-center text-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-accent-2">
                    <s.icon size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/85 mb-1">{s.title}</div>
                    <div className="text-xs text-white/40">{s.body}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </main>
    </>
  );
}
