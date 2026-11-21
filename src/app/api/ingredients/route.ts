import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getCurrentUser } from "@/backend/auth";
import { Role } from "@prisma/client";
import { readUnitConfig, readWhole, UnitValidationError } from "@/shared/inventory/stock-units";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const withBatches = req.nextUrl.searchParams.get("includeBatches") === "true";
  const wantsArchived = req.nextUrl.searchParams.get("includeArchived") === "true" && !withBatches;
  // Archived stock is visible only to an active Owner (for restoration/auditing).
  let includeArchived = false;
  if (wantsArchived && user.role === Role.OWNER) {
    const account = await prisma.user.findUnique({ where: { id: user.userId }, select: { role: true, isActive: true } });
    includeArchived = account?.role === Role.OWNER && account.isActive;
  }
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
    where: includeArchived ? {} : { isActive: true },
    ...(withBatches ? { include: { batches: { orderBy: [{ expiresAt: "asc" as const }, { receivedAt: "asc" as const }] } } } : {}),
  });

  return NextResponse.json({ ingredients });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RBAC: Only OWNER can create master ingredients
  if (user.role !== Role.OWNER) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya pemilik yang dapat menambahkan master bahan baku" },
      { status: 403 }
    );
  }

  try {
    const { name, unit, alternateUnit, unitsPerAlternate, minimumStock, notes } = await req.json();

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Nama dan satuan bahan baku wajib diisi" },
        { status: 400 }
      );
    }

    const units = readUnitConfig(unit, alternateUnit, unitsPerAlternate);
    const minimum = readWhole(minimumStock ?? 0, 0, "Ambang minimum");
    const newIngredient = await prisma.ingredient.create({
      data: {
        name: name.trim(),
        ...units,
        minimumStock: minimum,
        notes: typeof notes === "string" ? notes.trim() || null : null,
        isActive: true,
      },
    });

    return NextResponse.json({ ingredient: newIngredient }, { status: 201 });
  } catch (error: any) {
    if (error instanceof UnitValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Nama bahan baku sudah terdaftar" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Gagal menyimpan bahan baku" }, { status: 500 });
  }
}

