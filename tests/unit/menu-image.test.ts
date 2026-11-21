import { describe, expect, it } from "vitest";
import { detectMenuImageMime, MAX_MENU_IMAGE_BYTES, validateMenuImage, MenuImageError } from "@/backend/menus/menu-image";

const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0]);
const jpeg = Uint8Array.from([255,216,255,225,0]);
const webp = Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80]);

describe("upload foto menu", () => {
  it("mendeteksi JPG, PNG, dan WebP berdasarkan isi, bukan ekstensi", () => {
    expect(detectMenuImageMime(jpeg)).toBe("image/jpeg");
    expect(detectMenuImageMime(png)).toBe("image/png");
    expect(detectMenuImageMime(webp)).toBe("image/webp");
  });
  it("menolak SVG dan berkas yang menyamar sebagai gambar", () => {
    expect(() => validateMenuImage(new TextEncoder().encode('<svg onload="alert(1)"/>'), "image/svg+xml")).toThrow(MenuImageError);
    expect(() => validateMenuImage(jpeg, "image/png")).toThrow("Tipe gambar");
  });
  it("menolak file kosong dan yang melebihi batas ukuran", () => {
    expect(() => validateMenuImage(new Uint8Array())).toThrow(MenuImageError);
    expect(() => validateMenuImage(new Uint8Array(MAX_MENU_IMAGE_BYTES + 1))).toThrow(MenuImageError);
  });
  it("menerima foto yang valid", () => {
    expect(validateMenuImage(png, "image/png")).toBe("image/png");
  });
});
