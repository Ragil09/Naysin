import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getCurrentUser } from "@/backend/auth";
import { Prisma, Role } from "@prisma/client";
import { readUnitConfig, readWhole, UnitValidationError } from "@/shared/inventory/stock-units";
import { ingredientDeleteDecision } from "@/backend/inventory/ingredient-delete-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== Role.OWNER) return NextResponse.json({ error: "Hanya Owner yang dapat mengubah bahan baku" }, { status: 403 });
  const account = await prisma.user.findUnique({ where: { id: user.userId }, select: { role: true, isActive: true } });
  if (!account?.isActive || account.role !== Role.OWNER) return NextResponse.json({ error: "Akses ditolak: hanya Owner aktif yang dapat mengubah bahan baku." }, { status: 403 });
  const { id } = await params;
  try {
    const body = await req.json();
    const updated = await prisma.$transaction(async tx => {
      const current = await tx.ingredient.findUnique({ where: { id }, include: { _count: { select: { batches: true, transactions: true } } } });
      if (!current) return null;
      const data: Prisma.IngredientUpdateInput = {};
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || !body.name.trim()) throw new UnitValidationError("Nama bahan baku wajib diisi");
        data.name = body.name.trim();
      }
      if (body.minimumStock !== undefined) data.minimumStock = readWhole(body.minimumStock, 0, "Ambang minimum");
      if (body.notes !== undefined) data.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
      if (typeof body.isActive === "boolean") data.isActive = body.isActive;
      if (body.unit !== undefined || body.alternateUnit !== undefined || body.unitsPerAlternate !== undefined) {
        const units = readUnitConfig(body.unit ?? current.unit, body.alternateUnit === undefined ? current.alternateUnit : body.alternateUnit, body.unitsPerAlternate === undefined ? current.unitsPerAlternate : body.unitsPerAlternate);
        if (units.unit !== current.unit && (current.currentStock !== 0 || current._count.batches > 0 || current._count.transactions > 0)) {
          throw new UnitValidationError("Satuan dasar tidak dapat diganti setelah ada stok, batch, atau riwayat transaksi. Satuan tambahan dan isi kemasan tetap dapat diubah.");
        }
        Object.assign(data, units);
      }
      return tx.ingredient.update({ where: { id }, data });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!updated) return NextResponse.json({ error: "Bahan baku tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ ingredient: updated });
  } catch (error: any) {
    if (error instanceof UnitValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error.code === "P2002") return NextResponse.json({ error: "Nama bahan baku sudah terdaftar" }, { status: 409 });
    if (error.code === "P2034") return NextResponse.json({ error: "Data berubah bersamaan. Muat ulang dan coba kembali." }, { status: 409 });
    return NextResponse.json({ error: "Gagal memperbarui data bahan baku" }, { status: 500 });
  }
}

/**
 * Delete unused ingredient masters; preserve records with audit history by archiving.
 * Stock and menu-composition dependencies must be resolved before deletion.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  if (session.role !== Role.OWNER) return NextResponse.json({ error: "Hanya Owner yang dapat menghapus bahan baku." }, { status: 403 });
  try {
    const account = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, isActive: true } });
    if (!account?.isActive || account.role !== Role.OWNER) {
      return NextResponse.json({ error: "Akses ditolak: akun Owner tidak aktif atau role telah berubah." }, { status: 403 });
    }
    const { id } = await params;
    const result = await prisma.$transaction(async tx => {
      const current = await tx.ingredient.findUnique({
        where: { id },
        select: {
          id: true, isActive: true, currentStock: true,
          _count: { select: { menuItems: true, batches: true, transactions: true } },
        },
      });
      if (!current || !current.isActive) return { status: 404 as const, error: "Bahan baku aktif tidak ditemukan." };
      const decision = ingredientDeleteDecision({
        currentStock: current.currentStock,
        menuItems: current._count.menuItems,
        batches: current._count.batches,
        transactions: current._count.transactions,
      });
      if (!decision.allowed) return { status: 409 as const, error: decision.message };
      if (decision.action === "archived") {
        await tx.ingredient.update({ where: { id }, data: { isActive: false } });
        return { status: 200 as const, action: "archived" as const };
      }
      await tx.ingredient.delete({ where: { id } });
      return { status: 200 as const, action: "deleted" as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ action: result.action, message: result.action === "archived" ? "Bahan baku diarsipkan karena memiliki riwayat stok. Riwayat tetap aman." : "Bahan baku berhasil dihapus." });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "P2003" || code === "P2034" || code === "P2025") return NextResponse.json({ error: "Bahan baku berubah atau masih digunakan. Muat ulang lalu coba lagi." }, { status: 409 });
    console.error("Ingredient delete failed", error);
    return NextResponse.json({ error: "Gagal menghapus bahan baku." }, { status: 500 });
  }
}
