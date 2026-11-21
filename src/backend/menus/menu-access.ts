import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/backend/db";
import { getCurrentUser } from "@/backend/auth";
import { MenuValidationError } from "./menu-input";

export async function menuAccess(ownerOnly = false) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  const account = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, isActive: true } });
  if (!account?.isActive || (ownerOnly && (session.role !== Role.OWNER || account.role !== Role.OWNER))) return NextResponse.json({ error: "Akses ditolak. Hanya Owner aktif yang dapat mengelola menu." }, { status: 403 });
  return null;
}
export function menuError(error: unknown) {
  if (error instanceof MenuValidationError || error instanceof SyntaxError) return NextResponse.json({ error: error instanceof MenuValidationError ? error.message : "Format data tidak valid." }, { status: 400 });
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2002" || code === "P2034") return NextResponse.json({ error: "Nama/tag/istilah sudah terdaftar atau data berubah bersamaan. Muat ulang dan coba kembali." }, { status: 409 });
  if (code === "P2025") return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
  console.error("Menu API error", error);
  return NextResponse.json({ error: "Gagal memproses data menu." }, { status: 500 });
}
