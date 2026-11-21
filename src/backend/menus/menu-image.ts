/** Validasi berkas foto menu sebelum menyimpan ke PostgreSQL. */
export const MAX_MENU_IMAGE_BYTES = 1_500_000; // 1,5 MB/gambar

export class MenuImageError extends Error {
  constructor(message: string) { super(message); this.name = "MenuImageError"; }
}

export function detectMenuImageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function validateMenuImage(bytes: Uint8Array, declaredType?: string) {
  if (bytes.length === 0 || bytes.length > MAX_MENU_IMAGE_BYTES) throw new MenuImageError("Ukuran gambar harus antara 1 byte dan 1,5 MB. Kompres gambar sebelum mengunggah.");
  const mime = detectMenuImageMime(bytes);
  if (!mime) throw new MenuImageError("Format gambar tidak didukung. Pilih JPG, PNG, atau WebP (bukan SVG/HEIC).");
  if (declaredType && declaredType !== mime && declaredType !== "application/octet-stream") throw new MenuImageError("Tipe gambar tidak sesuai isi berkas.");
  return mime;
}
