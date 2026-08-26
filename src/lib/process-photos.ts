import exifr from "exifr";
import imageCompression from "browser-image-compression";

export type ParsedPhoto = {
  file: File;
  name: string;
  lat: number | null;
  lng: number | null;
  time: Date | null;
};

export type GeoPhoto = ParsedPhoto & { lat: number; lng: number; time: Date };

export async function parsePhotoExif(file: File): Promise<ParsedPhoto> {
  let lat: number | null = null;
  let lng: number | null = null;
  let time: Date | null = null;
  try {
    const gps = await exifr.gps(file);
    const exif = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
    // Some cameras write GPS tags even without a fix, as 0/0 degree-minute-
    // second fractions -- exifr still returns a non-null gps object in that
    // case, just with NaN lat/lng. Treat that the same as "no GPS" instead
    // of letting NaN leak into the distance/route math downstream.
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      lat = gps.latitude;
      lng = gps.longitude;
    }
    time = exif?.DateTimeOriginal ?? exif?.CreateDate ?? (file.lastModified ? new Date(file.lastModified) : null);
  } catch (err) {
    console.warn("EXIF parse failed for", file.name, err);
  }
  return { file, name: file.name, lat, lng, time };
}

const FALLBACK_MAX_BYTES = 15 * 1024 * 1024;

// Downscale + re-encode client-side before upload. Keeps storage/bandwidth
// costs low and the share page fast, at the cost of the original resolution.
//
// Some formats (HEIC/HEIF from iPhones, mainly) can't be decoded onto a
// <canvas> in most browsers, so compression throws even though EXIF parsing
// (a binary read, not a decode) worked fine. In that case fall back to
// uploading the original bytes rather than dropping the photo.
export async function compressPhoto(file: File, opts?: { maxWidthOrHeight?: number; maxSizeMB?: number }): Promise<Blob> {
  try {
    return await imageCompression(file, {
      maxWidthOrHeight: opts?.maxWidthOrHeight ?? 1600,
      maxSizeMB: opts?.maxSizeMB ?? 0.4,
      fileType: "image/webp",
      initialQuality: 0.75,
      useWebWorker: true,
    });
  } catch (err) {
    console.warn(`Compression failed for ${file.name}, falling back to the original file`, err);
    if (file.size > FALLBACK_MAX_BYTES) {
      throw new Error(`${file.name}: không nén được (định dạng trình duyệt không đọc được) và file gốc quá lớn để tải lên trực tiếp.`);
    }
    return file;
  }
}
