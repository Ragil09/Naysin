import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { menuAccess, menuError } from "@/backend/menus/menu-access";
import { MAX_MENU_IMAGE_BYTES, MenuImageError, validateMenuImage } from "@/backend/menus/menu-image";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Owner/Staff boleh melihat foto pada halaman Master Menu, termasuk menu nonaktif.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const denied = await menuAccess(); if (denied) return denied;
  const { id } = await params;
  const image = await prisma.menuImage.findUnique({ where: { menuId: id }, select: { bytes: true, mimeType: true } });
  if (!image) return new Response("Tidak ditemukan", { status: 404 });
  const binary = new Uint8Array(image.bytes.byteLength);
  binary.set(image.bytes);
  return new Response(binary.buffer, { status: 200, headers: {
    "Content-Type": image.mimeType,
    "Content-Length": String(binary.byteLength),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}

// Hanya Owner aktif yang boleh mengunggah gambar menu.
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const denied = await menuAccess(true); if (denied) return denied;
    const { id } = await params;
    const menu = await prisma.menu.findUnique({ where: { id }, select: { id: true } });
    if (!menu) return NextResponse.json({ error: "Menu tidak ditemukan." }, { status: 404 });
    const form = await req.formData();
    const upload = form.get("image");
    if (!(upload instanceof File)) return NextResponse.json({ error: "Pilih gambar untuk diunggah." }, { status: 400 });
    if (!upload.size || upload.size > MAX_MENU_IMAGE_BYTES) return NextResponse.json({ error: "Ukuran gambar maksimal 1,5 MB." }, { status: 413 });
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const mimeType = validateMenuImage(bytes, upload.type);
    await prisma.menuImage.upsert({ where: { menuId: id }, create: { menuId: id, bytes, mimeType }, update: { bytes, mimeType } });
    return NextResponse.json({ message: "Gambar menu berhasil disimpan.", imageUrl: `/api/public/menu-images/${encodeURIComponent(id)}` });
  } catch (error) {
    if (error instanceof MenuImageError) return NextResponse.json({ error: error.message }, { status: 400 });
    return menuError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const denied = await menuAccess(true); if (denied) return denied;
    const { id } = await params;
    const menu = await prisma.menu.findUnique({ where: { id }, select: { id: true } });
    if (!menu) return NextResponse.json({ error: "Menu tidak ditemukan." }, { status: 404 });
    await prisma.menuImage.deleteMany({ where: { menuId: id } });
    return NextResponse.json({ message: "Gambar menu berhasil dihapus." });
  } catch (error) { return menuError(error); }
}
