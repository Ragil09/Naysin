/** Link pemesanan manual via WhatsApp; tidak mengirim pesan secara otomatis. */
export function normalizeWhatsAppNumber(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, "");
  const international = digits.startsWith("0") ? `62${digits.slice(1)}` :
    digits.startsWith("8") ? `62${digits}` : digits;
  // Nomor ponsel Indonesia; jangan menautkan ke nomor yang salah format.
  return /^628\d{7,11}$/.test(international) ? international : null;
}

export function createWhatsAppOrderLink(
  phone: string | null,
  menu: { name: string; price: number | null; isAvailable: boolean },
): string | null {
  if (!phone || !menu.isAvailable) return null;
  const price = menu.price === null ? "Mohon konfirmasi harga" : `Rp${menu.price.toLocaleString("id-ID")}`;
  const message = [
    "Halo Nays Kopi, saya ingin memesan:",
    "",
    `Menu: ${menu.name}`,
    "Jumlah: 1",
    `Harga satuan: ${price}`,
    "",
    "Apakah menu tersebut tersedia? Terima kasih.",
  ].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
