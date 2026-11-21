import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getCurrentUser } from "@/backend/auth";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const privateHeaders = { "Cache-Control": "private, no-store" };
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401, headers: privateHeaders });
  }
  if (user.role !== Role.OWNER) {
    return NextResponse.json({ error: "Akses ditolak: hanya Owner yang dapat mengekspor laporan stok" }, { status: 403, headers: privateHeaders });
  }
  // Do not rely only on the role stored in a previously issued JWT.
  const account = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { role: true, isActive: true },
  });
  if (!account?.isActive || account.role !== Role.OWNER) {
    return NextResponse.json({ error: "Akses ditolak: akun Owner tidak aktif atau role telah berubah" }, { status: 403, headers: privateHeaders });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");

  const transactions = await prisma.stockTransaction.findMany({
    include: {
      ingredient: { select: { name: true, unit: true } },
      user: { select: { name: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  if (format === "csv") {
    // Generate CSV export directly in memory without disk writes
    const headers = ["ID", "Waktu", "Bahan", "Tipe", "Kuantitas", "Satuan", "Sebelum", "Sesudah", "Petugas", "Catatan", "Jumlah Input", "Satuan Input", "Faktor Konversi"];
    const rows = transactions.map((t) => [
      t.id,
      t.createdAt.toISOString(),
      `"${t.ingredient.name.replace(/"/g, '""')}"`,
      t.type,
      t.quantity,
      t.ingredient.unit,
      t.beforeQty,
      t.afterQty,
      `"${t.user.name.replace(/"/g, '""')}"`,
      `"${(t.note || "").replace(/"/g, '""')}"`,
      t.enteredQuantity ?? t.quantity,
      t.enteredUnit ?? t.ingredient.unit,
      t.enteredFactor ?? 1,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        ...privateHeaders,
        "X-Content-Type-Options": "nosniff",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="naysin_stock_report_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ transactions }, { headers: privateHeaders });
}

