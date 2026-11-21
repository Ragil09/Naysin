import { describe, expect, it } from "vitest";
import { createWhatsAppOrderLink, normalizeWhatsAppNumber } from "@/shared/whatsapp-order";

describe("pemesanan katalog publik", () => {
  it("menormalisasi nomor telepon mitra", () => {
    expect(normalizeWhatsAppNumber("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeWhatsAppNumber("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizeWhatsAppNumber("")).toBeNull();
    expect(normalizeWhatsAppNumber("abc")).toBeNull();
  });
  it("membuat pesan pesan dengan harga dan jumlah", () => {
    const url = createWhatsAppOrderLink("6281234567890", { name: "Matcha Strawberry", price: 24000, isAvailable: true });
    expect(url).toContain("https://wa.me/6281234567890?text=");
    const text = new URL(url!).searchParams.get("text")!;
    expect(text).toContain("Matcha Strawberry");
    expect(text).toContain("Rp24.000");
    expect(text).toContain("Jumlah: 1");
  });
  it("tidak membuat tautan tanpa nomor atau jika menu tak tersedia", () => {
    const menu = { name: "Matcha", price: null, isAvailable: true };
    expect(createWhatsAppOrderLink(null, menu)).toBeNull();
    expect(createWhatsAppOrderLink("6281234567890", { ...menu, isAvailable: false })).toBeNull();
  });
});
