import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { buildIngredientCsv } from "@/backend/inventory/ingredient-csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const privateHeaders = { "Cache-Control": "private, no-store" };
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401, headers: privateHeaders });
    }
    if (session.role !== Role.OWNER) {
      return NextResponse.json({ error: "Akses ditolak: hanya Owner yang dapat mengekspor bahan baku" }, { status: 403, headers: privateHeaders });
    }
    // Recheck the actual account in case its role or active status has changed.
    const account = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, isActive: true } });
    if (!account?.isActive || account.role !== Role.OWNER) {
      return NextResponse.json({ error: "Akses ditolak: akun Owner tidak aktif atau role telah berubah" }, { status: 403, headers: privateHeaders });
    }
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { name: "asc" },
      select: { name: true, currentStock: true, minimumStock: true, unit: true, alternateUnit: true, unitsPerAlternate: true, isActive: true, notes: true },
    });
    const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return new Response(buildIngredientCsv(ingredients), {
      headers: {
        ...privateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="naysin_bahan_baku_${date}.csv"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Ingredient CSV export failed", error);
    return NextResponse.json({ error: "Gagal mengekspor bahan baku" }, { status: 500, headers: privateHeaders });
  }
}
