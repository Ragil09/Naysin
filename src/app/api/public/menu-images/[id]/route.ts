import { prisma } from "@/backend/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hanya gambar menu yang tersedia yang disajikan ke publik.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = await prisma.menuImage.findUnique({
    where: { menuId: id },
    select: { bytes: true, mimeType: true, menu: { select: { isAvailable: true } } },
  });
  if (!image?.menu.isAvailable) return new Response("Tidak ditemukan", { status: 404 });
  // Buat ArrayBuffer mandiri agar kompatibel dengan tipe Response di Node/Next.
  const binary = new Uint8Array(image.bytes.byteLength);
  binary.set(image.bytes);
  return new Response(binary.buffer, { status: 200, headers: {
    "Content-Type": image.mimeType,
    "Content-Length": String(binary.byteLength),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
