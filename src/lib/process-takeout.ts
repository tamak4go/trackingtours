import { unzipSync, type Unzipped } from "fflate";

const IMAGE_EXT = /\.(jpe?g|png|heic|heif|tiff?|webp)$/i;

export type GeoFallback = { lat: number | null; lng: number | null; time: Date | null };

export type TakeoutExtraction = {
  files: File[];
  // Keyed by the (possibly de-duplicated) file name assigned in `files`.
  // Used only when a photo's own EXIF has no GPS -- Takeout's JSON sidecar
  // carries Google's best-effort location guess for those cases.
  geoFallback: Map<string, GeoFallback>;
  skippedNonImages: number;
};

function mimeFor(name: string): string {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.heic$/i.test(name)) return "image/heic";
  if (/\.heif$/i.test(name)) return "image/heif";
  if (/\.tiff?$/i.test(name)) return "image/tiff";
  return "image/jpeg";
}

// Takeout names the JSON sidecar after the image with a suffix, but the
// exact suffix has changed across export format versions, and very long
// combined names get silently truncated by Google's export tool. Try the
// known variants before giving up on a fallback for this photo.
function findSidecarPath(entries: Unzipped, imagePath: string): string | null {
  const candidates = [
    `${imagePath}.supplemental-metadata.json`,
    `${imagePath}.suppl.json`,
    `${imagePath}.json`,
  ];
  for (const c of candidates) if (entries[c]) return c;

  // Fallback: some exports truncate the image's own extension out of the
  // sidecar name (e.g. "IMG_0001.jp.supplemental-metadata.json"). Look for
  // any sidecar in the same folder that starts with the image's basename.
  const dir = imagePath.includes("/") ? imagePath.slice(0, imagePath.lastIndexOf("/") + 1) : "";
  const base = imagePath.slice(dir.length).replace(IMAGE_EXT, "");
  const prefixed = Object.keys(entries).find(
    (k) => k.startsWith(dir + base) && k.endsWith(".json") && k !== imagePath,
  );
  return prefixed ?? null;
}

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  let n = 2;
  while (used.has(`${base}_${n}${ext}`)) n++;
  const finalName = `${base}_${n}${ext}`;
  used.add(finalName);
  return finalName;
}

// Parses one or more Google Takeout export zips (large exports are split
// into takeout-*-1.zip, -2.zip, ...) into plain Files, ready to feed through
// the same EXIF + compression pipeline used for a local folder upload.
export async function extractTakeoutZips(
  zipFiles: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<TakeoutExtraction> {
  const files: File[] = [];
  const geoFallback = new Map<string, GeoFallback>();
  const usedNames = new Set<string>();
  let skippedNonImages = 0;

  const perZip = await Promise.all(zipFiles.map((f) => f.arrayBuffer()));
  const allEntries = perZip.map((buf) => unzipSync(new Uint8Array(buf)));

  const totalImages = allEntries.reduce(
    (sum, entries) => sum + Object.keys(entries).filter((p) => IMAGE_EXT.test(p)).length,
    0,
  );
  let done = 0;

  for (const entries of allEntries) {
    const paths = Object.keys(entries);
    const imagePaths = paths.filter((p) => IMAGE_EXT.test(p));
    skippedNonImages += paths.length - imagePaths.length;

    for (const path of imagePaths) {
      const rawName = path.split("/").pop() || path;
      const name = uniqueName(rawName, usedNames);
      const file = new File([entries[path] as BlobPart], name, { type: mimeFor(name) });
      files.push(file);

      const sidecarPath = findSidecarPath(entries, path);
      if (sidecarPath) {
        try {
          const json = JSON.parse(new TextDecoder().decode(entries[sidecarPath]));
          const geo = json.geoDataExif?.latitude || json.geoDataExif?.longitude ? json.geoDataExif : json.geoData;
          const ts = json.photoTakenTime?.timestamp ?? json.creationTime?.timestamp;
          const time = ts ? new Date(Number(ts) * 1000) : null;
          // Takeout uses (0, 0) as its "no location" sentinel, not null.
          const hasGeo = geo && (geo.latitude !== 0 || geo.longitude !== 0);
          geoFallback.set(name, { lat: hasGeo ? geo.latitude : null, lng: hasGeo ? geo.longitude : null, time });
        } catch (err) {
          console.warn("Failed to parse Takeout sidecar JSON for", path, err);
        }
      }

      done++;
      onProgress?.(done, totalImages);
    }
  }

  return { files, geoFallback, skippedNonImages };
}
